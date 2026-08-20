import sys
import os
import uvicorn

# Automatically add the backend root folder to sys.path
# This ensures it works seamlessly across CMD, PowerShell, Bash, and VS Code
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config.settings import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
