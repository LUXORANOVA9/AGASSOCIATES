import asyncio
import time
from concurrent.futures import ThreadPoolExecutor

# Since we don't need the whole app, we just benchmark the endpoint logic
import sys
import os
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

# Let's write a targeted script to mock the actual issue

def mock_db_call():
    time.sleep(0.05)
    return 42

async def sync_endpoint():
    conn = mock_db_call()
    return conn

async def async_endpoint():
    conn = await asyncio.to_thread(mock_db_call)
    return conn

async def benchmark(endpoint_func, num_requests):
    start = time.time()
    tasks = [endpoint_func() for _ in range(num_requests)]
    await asyncio.gather(*tasks)
    return time.time() - start

async def run_benchmark():
    num_requests = 100

    # Warmup
    await benchmark(sync_endpoint, 10)
    await benchmark(async_endpoint, 10)

    sync_time = await benchmark(sync_endpoint, num_requests)
    async_time = await benchmark(async_endpoint, num_requests)

    print(f"Sync endpoint time (baseline): {sync_time:.2f}s")
    print(f"Async endpoint time (improved): {async_time:.2f}s")
    print(f"Improvement: {sync_time / async_time:.2f}x faster")

if __name__ == "__main__":
    asyncio.run(run_benchmark())
