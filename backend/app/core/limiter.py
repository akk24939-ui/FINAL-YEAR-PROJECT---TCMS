"""slowapi rate limiter — shared instance used by all routers."""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
