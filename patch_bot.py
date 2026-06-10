import json

def patch():
    file_path = "ag-associates-ai/backend/telegram_bot/bot.py"
    with open(file_path, "r") as f:
        content = f.read()

    new_cancel = """async def cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    cid = update.effective_chat.id
    r = await get_redis()
    removed = 0
    pipe = r.pipeline()
    for portal in ("any", "gras", "igr", "cersai", "sbi"):
        key = _pending_key(portal)
        for item in await r.lrange(key, 0, -1):
            try:
                if int(json.loads(item)["chat_id"]) == cid:
                    pipe.lrem(key, 1, item)
                    removed += 1
            except (json.JSONDecodeError, KeyError, ValueError):
                continue
    if removed:
        await pipe.execute()
        await update.message.reply_text(f"✅ Cancelled {removed} request(s).")
    else:
        await update.message.reply_text("📭 Nothing to cancel.")"""

    old_cancel = """async def cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    cid = update.effective_chat.id
    r = await get_redis()
    removed = 0
    for portal in ("any", "gras", "igr", "cersai", "sbi"):
        key = _pending_key(portal)
        for item in await r.lrange(key, 0, -1):
            try:
                if int(json.loads(item)["chat_id"]) == cid:
                    await r.lrem(key, 1, item)
                    removed += 1
            except (json.JSONDecodeError, KeyError, ValueError):
                continue
    if removed:
        await update.message.reply_text(f"✅ Cancelled {removed} request(s).")
    else:
        await update.message.reply_text("📭 Nothing to cancel.")"""

    updated_content = content.replace(old_cancel, new_cancel)
    with open(file_path, "w") as f:
        f.write(updated_content)

patch()
