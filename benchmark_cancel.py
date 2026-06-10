import asyncio
import json
import time
import random

# Mock redis setup
from redis.asyncio import Redis

async def get_redis():
    return Redis(host='localhost', port=6379, decode_responses=True)

async def setup_data(r: Redis, cid: int, count: int = 1000):
    for portal in ("any", "gras", "igr", "cersai", "sbi"):
        key = f"pending:{portal}"
        await r.delete(key)
        items = []
        for i in range(count):
            if i % 10 == 0:
                chat_id = cid
            else:
                chat_id = cid + 1
            items.append(json.dumps({"chat_id": str(chat_id), "val": i}))
        await r.rpush(key, *items)

async def cancel_original(r: Redis, cid: int):
    removed = 0
    for portal in ("any", "gras", "igr", "cersai", "sbi"):
        key = f"pending:{portal}"
        for item in await r.lrange(key, 0, -1):
            try:
                if int(json.loads(item)["chat_id"]) == cid:
                    await r.lrem(key, 1, item)
                    removed += 1
            except (json.JSONDecodeError, KeyError, ValueError):
                continue
    return removed

async def cancel_optimized(r: Redis, cid: int):
    removed = 0
    pipe = r.pipeline()
    for portal in ("any", "gras", "igr", "cersai", "sbi"):
        key = f"pending:{portal}"
        for item in await r.lrange(key, 0, -1):
            try:
                if int(json.loads(item)["chat_id"]) == cid:
                    pipe.lrem(key, 1, item)
                    removed += 1
            except (json.JSONDecodeError, KeyError, ValueError):
                continue
    if removed:
        await pipe.execute()
    return removed

async def main():
    r = await get_redis()
    cid = 123456

    await setup_data(r, cid, 500)

    start = time.time()
    await cancel_original(r, cid)
    duration_orig = time.time() - start
    print(f"Original: {duration_orig:.4f}s")

    await setup_data(r, cid, 500)

    start = time.time()
    await cancel_optimized(r, cid)
    duration_opt = time.time() - start
    print(f"Optimized: {duration_opt:.4f}s")

    print(f"Improvement: {duration_orig / duration_opt:.2f}x faster")

if __name__ == "__main__":
    asyncio.run(main())
