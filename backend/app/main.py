from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from app.config import settings
from app.routes.auth import router as auth_router
from app.routes.kana import kana_router
from app.routes.vocabulary import vocabulary_router

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.environment == "production" else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="JapanApp API",
    description="Backend API for JapanApp - Japanese learning platform",
    version="0.1.0",
    debug=settings.debug,
)

app.include_router(auth_router)
app.include_router(kana_router)
app.include_router(vocabulary_router)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return JSONResponse(
        {"status": "ok", "environment": settings.environment},
        status_code=200,
    )

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "JapanApp API",
        "version": "0.1.0",
        "documentation": "/docs",
    }

logger.info(f"JapanApp API started in {settings.environment} mode")
