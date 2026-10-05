# StockOracle Pro - portfolio positions & paper trading ledger.
# Moved verbatim from backend.data.database.
from .db_connection import *  # noqa: F401,F403
from .db_alerts import write_audit_log  # noqa: F401
from .db_caches import get_company_info  # noqa: F401
from .db_ticks import get_live_tick_ohlcv  # noqa: F401

# ── Portfolio Functions ────────────────────────────────────────────────────────

# ── Portfolio Functions ────────────────────────────────────────────────────────

def add_portfolio_position(ticker: str, shares: float, buy_price: float, user_id: str = "default_user") -> int:
    """Add a portfolio position via SQLAlchemy ORM and return the new row id."""
    now_ts = datetime.now(timezone.utc).isoformat()
    with get_db_session() as session:
        pos = PortfolioPosition(
            user_id=user_id,
            ticker=ticker.upper(),
            shares=float(shares),
            buy_price=float(buy_price),
            added_at=now_ts,
        )
        session.add(pos)
        session.flush()
        row_id = pos.id
    write_audit_log("ADD", "portfolio", entity_id=row_id,
                    details=f"ticker={ticker} shares={shares} buy_price={buy_price}",
                    user_id=user_id)
    return row_id


def get_portfolio(user_id: str = "default_user") -> list:
    """Return all portfolio positions for a user as a list of dicts."""
    with get_db_session() as session:
        stmt = select(PortfolioPosition).where(PortfolioPosition.user_id == user_id).order_by(PortfolioPosition.id.desc())
        rows = session.execute(stmt).scalars().all()
        return [{
            "id": r.id,
            "user_id": r.user_id,
            "ticker": r.ticker,
            "shares": r.shares,
            "buy_price": r.buy_price,
            "added_at": r.added_at,
        } for r in rows]


def remove_portfolio_position(position_id: int, user_id: str = "default_user"):
    """Delete a portfolio position by id and user_id."""
    with get_db_session() as session:
        session.execute(
            delete(PortfolioPosition).where(PortfolioPosition.id == position_id, PortfolioPosition.user_id == user_id)
        )
    write_audit_log("REMOVE", "portfolio", entity_id=position_id, user_id=user_id)


# ── Paper Trading Functions (₹10 Lakh Virtual Funds) ──────────────────────────

def get_paper_account(user_id: str = "default_user") -> dict:
    """Returns the paper trading account state, initializing with ₹1,000,000 if new."""
    now_str = datetime.now().isoformat()
    with get_db_session() as session:
        acc = session.get(PaperAccount, user_id)
        if not acc:
            acc = PaperAccount(
                user_id=user_id,
                cash_balance=1000000.0,
                starting_balance=1000000.0,
                updated_at=now_str
            )
            session.add(acc)
            session.commit()
            return {"user_id": user_id, "cash_balance": 1000000.0, "starting_balance": 1000000.0, "updated_at": now_str}
        return {
            "user_id": acc.user_id,
            "cash_balance": acc.cash_balance,
            "starting_balance": acc.starting_balance,
            "updated_at": acc.updated_at
        }


def get_paper_positions(user_id: str = "default_user", enforce_stops: bool = False) -> list:
    """Returns active open paper trading positions enriched with live LTP, market value, and unrealized P&L.

    Pure read by default: SL/TP auto-exits are NOT evaluated here so a GET
    can never liquidate positions (cash-debited-but-no-position bug). Pass
    enforce_stops=True only from an explicit SL/TP evaluation path
    (see enforce_paper_stops()) — never from a generic read.
    """
    with get_db_session() as session:
        stmt = select(PaperPosition).where(PaperPosition.user_id == user_id).order_by(PaperPosition.id.desc())
        rows = session.execute(stmt).scalars().all()
        positions = []
        for r in rows:
            p = {
                "id": r.id,
                "user_id": r.user_id,
                "ticker": r.ticker,
                "order_type": r.order_type,
                "shares": r.shares,
                "avg_buy_price": r.avg_buy_price,
                "stop_loss": r.stop_loss,
                "target_price": r.target_price,
                "opened_at": r.opened_at,
            }
            ticker = p["ticker"]
            shares = float(p["shares"])
            buy_p = float(p["avg_buy_price"])

            current_p = buy_p
            sector = "Diversified"
            info = None
            try:
                info = get_company_info(ticker)
                if info and info.get("current_price") and float(info["current_price"]) > 0:
                    current_p = float(info["current_price"])
                else:
                    m = session.get(ScreenerDailyMetric, ticker)
                    if m and m.close_price:
                        current_p = float(m.close_price)
                    if m and m.sector:
                        sector = m.sector
            except Exception as exc:
                logger.debug("Paper position enrichment fallback for %s: %s", ticker, exc)
                current_p = buy_p

            # ── SL/TP auto-exit freshness guard ─────────────────────────────
            # Exits are evaluated ONLY when enforce_stops=True AND against
            # verified, fresh prices while the market is open:
            #   1. today's real live ticks (actual traded prices), or
            #   2. a fresh quote while the market is open.
            # Stale caches, daily-close fallbacks, or after-hours ticks must
            # NEVER liquidate a position from a read path.
            verified_p = None
            if enforce_stops:
                try:
                    from backend.data.market_calendar import is_market_open as _is_open
                    _market_open = bool(_is_open())
                except Exception:
                    _market_open = False
                if _market_open:
                    try:
                        ticks_ohlcv = get_live_tick_ohlcv(ticker)
                        if ticks_ohlcv and ticks_ohlcv.get("close") and float(ticks_ohlcv["close"]) > 0:
                            verified_p = float(ticks_ohlcv["close"])
                    except Exception as exc:
                        logger.debug("Paper SL/TP tick lookup failed for %s: %s", ticker, exc)
                        verified_p = None
                    if verified_p is None and info and info.get("current_price"):
                        try:
                            if float(info["current_price"]) > 0:
                                verified_p = float(info["current_price"])
                        except Exception as exc:
                            logger.debug("Paper SL/TP quote lookup failed for %s: %s", ticker, exc)
                            verified_p = None

            sl = float(p["stop_loss"]) if p.get("stop_loss") else None
            tp = float(p["target_price"]) if p.get("target_price") else None
            if enforce_stops and verified_p is not None:
                if sl and verified_p <= sl:
                    close_paper_position(p["id"], current_price=verified_p, user_id=user_id, exit_reason="STOP_LOSS_HIT")
                    continue
                if tp and verified_p >= tp:
                    close_paper_position(p["id"], current_price=verified_p, user_id=user_id, exit_reason="TARGET_HIT")
                    continue

            invested_val = round(shares * buy_p, 2)
            market_val = round(shares * current_p, 2)
            unrealized = round((current_p - buy_p) * shares, 2)
            unrealized_pct = round(((current_p - buy_p) / max(0.01, buy_p)) * 100, 2)

            p["current_price"] = round(current_p, 2)
            p["sector"] = sector
            p["invested_value"] = invested_val
            p["market_value"] = market_val
            p["unrealized_pnl"] = unrealized
            p["unrealized_pnl_pct"] = unrealized_pct
            positions.append(p)

        return positions


def enforce_paper_stops(user_id: str = "default_user") -> list:
    """Explicit SL/TP evaluation pass. Returns list of auto-closed position dicts.

    Call this from a scheduler or an explicit user action — never from a
    read-only getter. Only runs while the market is open.
    """
    try:
        from backend.data.market_calendar import is_market_open
        if not is_market_open():
            return []
    except Exception as exc:
        logger.debug("Paper stop enforcement market-open check failed: %s", exc)
        return []
    # Re-read with enforcement enabled; closed positions are skipped inside.
    get_paper_positions(user_id=user_id, enforce_stops=True)
    return get_paper_trade_history(user_id=user_id, limit=10)


def place_paper_order(ticker: str, order_type: str, action: str, shares: float, price: float, stop_loss: float = None, target_price: float = None, notes: str = None, user_id: str = "default_user") -> dict:
    """Executes a paper order atomically under transaction lock."""
    ticker_u = ticker.upper().strip()
    action_u = action.upper().strip()
    order_type_u = order_type.upper().strip()
    total_cost = float(shares) * float(price)
    now_str = datetime.now().isoformat()

    if action_u != "BUY":
        raise ValueError("Direct SELL without position not supported. Use sell_paper_position() to exit holdings.")

    if shares <= 0 or price <= 0:
        raise ValueError("Shares and price must be positive numbers.")

    with get_db_session() as session:
        acc = session.get(PaperAccount, user_id)
        if not acc:
            acc = PaperAccount(user_id=user_id, cash_balance=1000000.0, starting_balance=1000000.0, updated_at=now_str)
            session.add(acc)
            session.flush()

        if acc.cash_balance < total_cost:
            raise ValueError(f"Insufficient virtual cash balance. Needed ₹{total_cost:,.2f}, Available ₹{acc.cash_balance:,.2f}")

        acc.cash_balance -= total_cost
        acc.updated_at = now_str
        new_cash = acc.cash_balance

        pos = PaperPosition(
            user_id=user_id,
            ticker=ticker_u,
            order_type=order_type_u,
            shares=float(shares),
            avg_buy_price=float(price),
            stop_loss=float(stop_loss) if stop_loss else None,
            target_price=float(target_price) if target_price else None,
            opened_at=now_str,
        )
        session.add(pos)
        session.flush()
        pos_id = pos.id

        order_note = notes or f"BUY {ticker_u} @ ₹{price:.2f}"
        order = PaperOrder(
            user_id=user_id,
            ticker=ticker_u,
            order_type=order_type_u,
            action="BUY",
            shares=float(shares),
            executed_price=float(price),
            realized_pnl=0.0,
            status=order_note,
            executed_at=now_str,
        )
        session.add(order)

    write_audit_log("BUY", "paper_order", entity_id=pos_id,
                    details=f"ticker={ticker_u} shares={shares} price={price} cost={total_cost:.2f}",
                    user_id=user_id)
    return {"status": "SUCCESS", "position_id": pos_id, "action": "BUY", "ticker": ticker_u, "shares": shares, "price": price, "remaining_cash": new_cash}



def sell_paper_position(position_id: int, shares_to_sell: float, current_price: float, notes: str = None, user_id: str = "default_user") -> dict:
    """Executes a full or partial sell order on an open paper position atomically."""
    if shares_to_sell <= 0 or current_price <= 0:
        raise ValueError("Shares to sell and current price must be greater than zero.")

    now_str = datetime.now().isoformat()
    with get_db_session() as session:
        pos = session.get(PaperPosition, position_id)
        if not pos or pos.user_id != user_id:
            raise ValueError(f"Position #{position_id} not found.")

        ticker = pos.ticker
        order_type = pos.order_type
        current_shares = float(pos.shares)
        if shares_to_sell > current_shares:
            shares_to_sell = current_shares

        buy_p = float(pos.avg_buy_price)
        pnl = (current_price - buy_p) * shares_to_sell
        proceeds = shares_to_sell * current_price

        # Update Account Cash
        acc = session.get(PaperAccount, user_id)
        if not acc:
            acc = PaperAccount(user_id=user_id, cash_balance=1000000.0, starting_balance=1000000.0, updated_at=now_str)
            session.add(acc)
            session.flush()

        acc.cash_balance += proceeds
        acc.updated_at = now_str
        new_cash = acc.cash_balance

        status_text = notes or ("CLOSED" if shares_to_sell >= current_shares else f"PARTIAL_SELL ({shares_to_sell}/{current_shares})")

        # Record Sell Order in Journal
        order = PaperOrder(
            user_id=user_id,
            ticker=ticker,
            order_type=order_type,
            action="SELL",
            shares=float(shares_to_sell),
            executed_price=float(current_price),
            realized_pnl=float(pnl),
            status=status_text,
            executed_at=now_str,
        )
        session.add(order)

        # Update or delete position
        remaining_shares = current_shares - shares_to_sell
        if remaining_shares > 0.0001:
            pos.shares = remaining_shares
        else:
            session.delete(pos)
            remaining_shares = 0.0

    write_audit_log("SELL", "paper_order", entity_id=position_id,
                    details=f"ticker={ticker} shares_sold={shares_to_sell} remaining={remaining_shares} exit_price={current_price} pnl={pnl:.2f}",
                    user_id=user_id)
    return {
        "status": "SUCCESS",
        "position_id": position_id,
        "ticker": ticker,
        "shares_sold": shares_to_sell,
        "remaining_shares": round(remaining_shares, 2),
        "exit_price": current_price,
        "realized_pnl": round(pnl, 2),
        "new_cash": round(new_cash, 2)
    }


def close_paper_position(position_id: int, current_price: float, user_id: str = "default_user", exit_reason: str = "MANUAL_CLOSE") -> dict:
    """Closes an open position fully at current live price and calculates realized P&L."""
    with get_db_session() as session:
        pos = session.get(PaperPosition, position_id)
        if not pos or pos.user_id != user_id:
            return {"status": "ERROR", "message": f"Position #{position_id} not found."}
        shares = float(pos.shares)

    result = sell_paper_position(
        position_id=position_id,
        shares_to_sell=shares,
        current_price=current_price,
        notes=exit_reason,
        user_id=user_id
    )
    # Contract: a full close reports "CLOSED" (partial sells keep "SUCCESS",
    # as returned by sell_paper_position). The frontend passes this status
    # through to the UI, and the API docs / tests assert on "CLOSED".
    if result.get("status") == "SUCCESS":
        result["status"] = "CLOSED"
    return result


def get_paper_trade_history(user_id: str = "default_user", limit: int = 100) -> list:
    """Returns past executed orders journal."""
    with get_db_session() as session:
        stmt = select(PaperOrder).where(PaperOrder.user_id == user_id).order_by(PaperOrder.id.desc()).limit(limit)
        rows = session.execute(stmt).scalars().all()
        return [{
            "id": r.id,
            "user_id": r.user_id,
            "ticker": r.ticker,
            "order_type": r.order_type,
            "action": r.action,
            "shares": r.shares,
            "executed_price": r.executed_price,
            "realized_pnl": r.realized_pnl,
            "status": r.status,
            "executed_at": r.executed_at,
        } for r in rows]


def get_paper_analytics(user_id: str = "default_user") -> dict:
    """Computes full portfolio analytics: net worth, win rate, profit factor, best/worst trade, and sector allocation."""
    account = get_paper_account(user_id=user_id)
    positions = get_paper_positions(user_id=user_id)
    history = get_paper_trade_history(user_id=user_id, limit=200)

    cash = float(account.get("cash_balance", 1000000.0))
    start_balance = float(account.get("starting_balance", 1000000.0))
    invested_val = sum(p.get("invested_value", 0.0) for p in positions)
    market_val = sum(p.get("market_value", 0.0) for p in positions)
    unrealized_pnl = sum(p.get("unrealized_pnl", 0.0) for p in positions)

    total_net_worth = cash + market_val
    total_realized_pnl = sum(float(h.get("realized_pnl") or 0.0) for h in history if h.get("action") == "SELL")

    # Trade statistics
    closed_trades = [h for h in history if h.get("action") == "SELL"]
    total_closed = len(closed_trades)
    winning_trades = [h for h in closed_trades if float(h.get("realized_pnl") or 0.0) > 0]
    losing_trades = [h for h in closed_trades if float(h.get("realized_pnl") or 0.0) < 0]

    win_count = len(winning_trades)
    loss_count = len(losing_trades)
    win_rate = round((win_count / total_closed * 100), 1) if total_closed > 0 else 0.0

    gross_profit = sum(float(h["realized_pnl"]) for h in winning_trades)
    gross_loss = abs(sum(float(h["realized_pnl"]) for h in losing_trades))
    profit_factor = round(gross_profit / max(1.0, gross_loss), 2) if gross_loss > 0 else (gross_profit if gross_profit > 0 else 1.0)

    best_trade = max([float(h["realized_pnl"]) for h in closed_trades], default=0.0)
    worst_trade = min([float(h["realized_pnl"]) for h in closed_trades], default=0.0)

    # Sector Allocation
    sector_map = {}
    for p in positions:
        sec = p.get("sector") or "Diversified"
        mval = float(p.get("market_value") or 0.0)
        sector_map[sec] = sector_map.get(sec, 0.0) + mval

    sector_allocation = []
    if market_val > 0:
        for sec, val in sorted(sector_map.items(), key=lambda x: x[1], reverse=True):
            sector_allocation.append({
                "sector": sec,
                "value": round(val, 2),
                "pct": round((val / market_val) * 100, 1)
            })

    total_return_pct = round(((total_net_worth - start_balance) / start_balance) * 100, 2)

    return {
        "cash_balance": round(cash, 2),
        "starting_balance": round(start_balance, 2),
        "invested_value": round(invested_val, 2),
        "market_value": round(market_val, 2),
        "total_net_worth": round(total_net_worth, 2),
        "total_realized_pnl": round(total_realized_pnl, 2),
        "total_unrealized_pnl": round(unrealized_pnl, 2),
        "total_return_pct": total_return_pct,
        "win_rate_pct": win_rate,
        "total_trades": total_closed,
        "win_count": win_count,
        "loss_count": loss_count,
        "profit_factor": profit_factor,
        "best_trade": round(best_trade, 2),
        "worst_trade": round(worst_trade, 2),
        "open_positions_count": len(positions),
        "sector_allocation": sector_allocation
    }


def reset_paper_account(user_id: str = "default_user") -> dict:
    """Resets paper trading account back to ₹1,000,000 and clears positions/orders."""
    now_str = datetime.now().isoformat()
    with get_db_session() as session:
        session.execute(delete(PaperPosition).where(PaperPosition.user_id == user_id))
        session.execute(delete(PaperOrder).where(PaperOrder.user_id == user_id))
        acc = session.get(PaperAccount, user_id)
        if acc:
            acc.cash_balance = 1000000.0
            acc.starting_balance = 1000000.0
            acc.updated_at = now_str
        else:
            session.add(PaperAccount(user_id=user_id, cash_balance=1000000.0, starting_balance=1000000.0, updated_at=now_str))
    write_audit_log("RESET", "paper_account", details="reset to ₹10,00,000", user_id=user_id)
    return {"status": "RESET", "cash_balance": 1000000.0}
