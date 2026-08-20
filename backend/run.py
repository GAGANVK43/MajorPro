import sys
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

# Automatically switch to virtual environment python if not active
venv_python = os.path.join(backend_dir, "venv", "Scripts", "python.exe")
if os.path.exists(venv_python) and os.path.abspath(sys.executable).lower() != os.path.abspath(venv_python).lower():
    import subprocess
    try:
        sys.exit(subprocess.call([venv_python] + sys.argv))
    except Exception:
        pass

import uvicorn
from app.config.settings import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
