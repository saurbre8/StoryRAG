import os
import redis
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Read Redis connection info
redis_host = os.getenv("REDIS_HOST")
redis_port = int(os.getenv("REDIS_PORT", "6379"))
redis_password = os.getenv("REDIS_PASSWORD2")

print(f"🔍 Testing Redis connection...")
print(f"  Host: {redis_host}")
print(f"  Port: {redis_port}")
print(f"  Password set: {'✅' if redis_password else '❌ (missing)'}")

try:
    # Connect to Redis
    r = redis.Redis(
        host=redis_host,
        port=redis_port,
        password=redis_password,
        decode_responses=True,
        ssl=False  # Disable SSL since your port doesn't support it
    )

    # Ping to test connection
    if r.ping():
        print("✅ Successfully connected to Redis!")
        # Optional: Try setting and getting a value
        r.set("connection_test_key", "success")
        value = r.get("connection_test_key")
        print(f"ℹ️ Test key value: {value}")
    else:
        print("❌ Ping failed. Connection did not succeed.")

except redis.exceptions.AuthenticationError:
    print("❌ Authentication failed. Check your Redis password.")
except redis.exceptions.ConnectionError as e:
    print(f"❌ Connection error: {e}")
except Exception as e:
    print(f"❌ Unexpected error: {e}")