"""Shared utilities: LLM retry wrapper and workforce-ledger activity hook."""

from tenacity import retry, stop_after_attempt, wait_exponential

try:
    from workforce.ledger import record_activity as record_activity
except Exception:  # workforce schema may not be migrated in some envs
    def record_activity(**_kwargs):  # type: ignore
        return None


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True,
)
def invoke_llm_with_retry(chain, inputs):
    """Wrap a LangChain runnable invocation in exponential-backoff retry."""
    return chain.invoke(inputs)
