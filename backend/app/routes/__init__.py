"""JapanApp FastAPI Backend /routes package.

Import routers directly from individual modules (auth.py, kana.py, ...).
This package intentionally does not re-export router objects to avoid
accidental duplicate exports and to make imports explicit in main.py.
"""
