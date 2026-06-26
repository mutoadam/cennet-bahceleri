async function sendTelegram(botToken, chatId, text) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });

  return await response.json();
}

exports.handler = async function(event) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const hasToken = Boolean(botToken);
  const hasChatId = Boolean(chatId);

  try {
    if (event.httpMethod === "GET") {
      const params = new URLSearchParams(event.rawQuery || "");

      if (params.get("test") === "1") {
        if (!hasToken || !hasChatId) {
          return {
            statusCode: 200,
            body: JSON.stringify({
              ok: false,
              mode: "diagnostic_test",
              hasToken,
              hasChatId,
              message: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID"
            })
          };
        }

        const result = await sendTelegram(
          botToken,
          chatId,
          "🌿 <b>Cennet Bahçeleri Telegram Test</b>\n\nNetlify Function başarıyla çalışıyor."
        );

        return {
          statusCode: 200,
          body: JSON.stringify({
            ok: true,
            mode: "diagnostic_test",
            hasToken,
            hasChatId,
            telegram: result
          })
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          mode: "diagnostic",
          hasToken,
          hasChatId,
          message: "Function is deployed. Use ?test=1 for Telegram test."
        })
      };
    }

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

    if (!hasToken || !hasChatId) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: false,
          hasToken,
          hasChatId,
          message: "Missing Telegram environment variables"
        })
      };
    }

    const data = JSON.parse(event.body || "{}");

    const safe = (value) => {
      if (!value) return "-";
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    };

    const message = `
🌿 <b>Yeni Cennet Bahçesi Önerisi</b>

📚 <b>Program:</b> ${safe(data.program_name)}
🕌 <b>Mekân:</b> ${safe(data.venue_name)}
📍 <b>İlçe:</b> ${safe(data.district)}
📅 <b>Gün:</b> ${safe(data.day)}
🕒 <b>Saat:</b> ${safe(data.time)}

👤 <b>Gönderen:</b> ${safe(data.contact_name)}
📞 <b>Telefon:</b> ${safe(data.contact_phone)}

🏢 <b>Kurum:</b> ${safe(data.organization)}
👨‍🏫 <b>Hoca:</b> ${safe(data.speaker)}
📝 <b>Açıklama:</b> ${safe(data.description)}

🔎 Supabase suggestions tablosundan inceleyebilirsiniz.
`.trim();

    const result = await sendTelegram(botToken, chatId, message);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, hasToken, hasChatId, telegram: result })
    };
  } catch (error) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: false,
        hasToken,
        hasChatId,
        error: error.message
      })
    };
  }
};
