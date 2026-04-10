/**
 * Minimal SMTP client compatible with modern Deno runtime.
 * Uses raw TCP/TLS connections with TextEncoder/TextDecoder.
 * Supports AUTH LOGIN and AUTH PLAIN.
 */

async function readResponse(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let result = "";
  const timeout = 15000;
  const start = Date.now();
  while (true) {
    if (Date.now() - start > timeout) {
      throw new Error(`SMTP read timeout after ${timeout}ms. Partial response: ${result}`);
    }
    const readPromise = reader.read();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("SMTP read chunk timeout")), timeout)
    );
    const { value, done } = await Promise.race([readPromise, timeoutPromise]);
    if (done) break;
    result += decoder.decode(value, { stream: true });
    // SMTP responses end with \r\n and a space after status code on the final line
    const lines = result.split("\r\n").filter(Boolean);
    const lastLine = lines[lines.length - 1];
    if (lastLine && /^\d{3} /.test(lastLine) && result.endsWith("\r\n")) break;
  }
  return result;
}

async function writeCommand(writer: WritableStreamDefaultWriter<Uint8Array>, cmd: string): Promise<void> {
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(cmd + "\r\n"));
}

function checkResponse(response: string, expectedCode: number): void {
  const code = parseInt(response.substring(0, 3), 10);
  if (code !== expectedCode) {
    throw new Error(`SMTP error: expected ${expectedCode}, got: ${response.trim()}`);
  }
}

/** Base64 encode that handles UTF-8 characters properly */
function safeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

export async function sendSmtpEmail(
  host: string,
  port: number,
  username: string,
  password: string,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  console.log(`[smtp] Connecting to ${host}:${port}...`);

  let conn: Deno.TcpConn | Deno.TlsConn;
  if (port === 465) {
    conn = await Deno.connectTls({ hostname: host, port });
  } else {
    conn = await Deno.connect({ hostname: host, port });
  }

  const reader = conn.readable.getReader();
  const writer = conn.writable.getWriter();

  try {
    // Read greeting
    const greeting = await readResponse(reader);
    console.log(`[smtp] Greeting: ${greeting.trim()}`);
    checkResponse(greeting, 220);

    // EHLO
    await writeCommand(writer, `EHLO localhost`);
    const ehloResp = await readResponse(reader);
    console.log(`[smtp] EHLO response: ${ehloResp.trim().substring(0, 200)}`);
    checkResponse(ehloResp, 250);

    // Determine supported auth methods
    const supportsPlain = /AUTH[^\r\n]*\bPLAIN\b/i.test(ehloResp);
    const supportsLogin = /AUTH[^\r\n]*\bLOGIN\b/i.test(ehloResp);
    console.log(`[smtp] Auth methods - PLAIN: ${supportsPlain}, LOGIN: ${supportsLogin}`);

    // STARTTLS for port 587
    if (port === 587) {
      if (/STARTTLS/i.test(ehloResp)) {
        await writeCommand(writer, `STARTTLS`);
        const starttlsResp = await readResponse(reader);
        checkResponse(starttlsResp, 220);
        console.log(`[smtp] STARTTLS initiated but upgrade not supported in this client. Use port 465 for TLS.`);
      }
    }

    // Try AUTH PLAIN first (more reliable with special characters), then AUTH LOGIN
    let authSuccess = false;

    if (supportsPlain) {
      try {
        // AUTH PLAIN: base64(\0username\0password)
        const plainStr = `\0${username}\0${password}`;
        const plainB64 = safeBase64(plainStr);
        await writeCommand(writer, `AUTH PLAIN ${plainB64}`);
        const authResp = await readResponse(reader);
        console.log(`[smtp] AUTH PLAIN response: ${authResp.trim()}`);
        checkResponse(authResp, 235);
        authSuccess = true;
      } catch (e) {
        console.warn(`[smtp] AUTH PLAIN failed: ${e.message}`);
      }
    }

    if (!authSuccess && supportsLogin) {
      try {
        await writeCommand(writer, `AUTH LOGIN`);
        const authResp = await readResponse(reader);
        checkResponse(authResp, 334);

        await writeCommand(writer, safeBase64(username));
        const userResp = await readResponse(reader);
        checkResponse(userResp, 334);

        await writeCommand(writer, safeBase64(password));
        const passResp = await readResponse(reader);
        console.log(`[smtp] AUTH LOGIN response: ${passResp.trim()}`);
        checkResponse(passResp, 235);
        authSuccess = true;
      } catch (e) {
        console.warn(`[smtp] AUTH LOGIN failed: ${e.message}`);
      }
    }

    if (!authSuccess) {
      // Last resort: try AUTH LOGIN even if not advertised
      try {
        await writeCommand(writer, `AUTH LOGIN`);
        const authResp = await readResponse(reader);
        checkResponse(authResp, 334);

        await writeCommand(writer, safeBase64(username));
        const userResp = await readResponse(reader);
        checkResponse(userResp, 334);

        await writeCommand(writer, safeBase64(password));
        const passResp = await readResponse(reader);
        checkResponse(passResp, 235);
        authSuccess = true;
      } catch (e) {
        throw new Error(
          `SMTP authentication failed. Please verify your SMTP email and password are correct. ` +
          `Host: ${host}, Port: ${port}, User: ${username}. Server error: ${e.message}`
        );
      }
    }

    console.log(`[smtp] Authenticated successfully`);

    // MAIL FROM
    await writeCommand(writer, `MAIL FROM:<${username}>`);
    const mailResp = await readResponse(reader);
    checkResponse(mailResp, 250);

    // RCPT TO
    await writeCommand(writer, `RCPT TO:<${to}>`);
    const rcptResp = await readResponse(reader);
    checkResponse(rcptResp, 250);

    // DATA
    await writeCommand(writer, `DATA`);
    const dataResp = await readResponse(reader);
    checkResponse(dataResp, 354);

    // Build email with proper headers
    const boundary = `boundary_${Date.now()}`;
    const message = [
      `From: ${username}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      html,
      ``,
      `--${boundary}--`,
      `.`,
    ].join("\r\n");

    const encoder = new TextEncoder();
    await writer.write(encoder.encode(message + "\r\n"));
    const sendResp = await readResponse(reader);
    checkResponse(sendResp, 250);

    console.log(`[smtp] Email sent successfully to ${to}`);

    // QUIT
    await writeCommand(writer, `QUIT`);
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
    try { writer.releaseLock(); } catch { /* ignore */ }
    try { conn.close(); } catch { /* ignore */ }
  }
}
