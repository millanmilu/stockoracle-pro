"""
StockOracle Pro — Unified Multi-Mode Master Entry Point
Supports:
  --mode web               : Starts FastAPI REST + WebSocket Server
  --mode terminal          : Launches interactive Bloomberg-style OpenTerminalUI
  --mode worker            : Launches Celery Background Worker Fleet
"""
import sys
import argparse
import uvicorn
import logging

from backend.core.config_loader import config
from backend.core.logging import configure_logging, get_logger

configure_logging()
logger = get_logger("stockoracle.entrypoint")


def main():
    parser = argparse.ArgumentParser(description="StockOracle Pro — Multi-Level Financial Terminal & API")
    parser.add_argument(
        "--mode",
        type=str,
        default="web",
        choices=["web", "terminal", "financial-terminal", "worker"],
        help="Execution mode: 'web' (API server), 'terminal' (OpenTerminalUI CLI), or 'worker' (Celery worker)"
    )
    parser.add_argument(
        "--symbol",
        type=str,
        default="RELIANCE",
        help="Initial stock ticker symbol when launching in terminal mode"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=config.PORT,
        help="Port number for web server mode"
    )
    parser.add_argument(
        "--host",
        type=str,
        default=config.HOST,
        help="Host binding for web server mode"
    )

    args = parser.parse_args()

    if args.mode in ["terminal", "financial-terminal"]:
        logger.info("Initializing OpenBB & OpenTerminalUI Institutional Terminal for %s...", args.symbol)
        from terminal_ui.institutional_terminal import launch_institutional_terminal
        launch_institutional_terminal(symbol=args.symbol)


    elif args.mode == "worker":
        logger.info("Starting Celery Worker Fleet...")
        from backend.services.tasks import celery_app
        celery_app.worker_main(["worker", "--loglevel=info"])

    else:
        # Default: Web API mode
        logger.info("Starting StockOracle Pro FastAPI Server on %s:%d...", args.host, args.port)
        uvicorn.run("backend.main:app", host=args.host, port=args.port, reload=config.DEBUG)


if __name__ == "__main__":
    main()
