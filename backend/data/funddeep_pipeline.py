"""Backend/data internals for fundamentals deep pipeline. AUTO-SPLIT from
fundamentals_deep.py -- content unchanged. Must never import
backend.data.fundamentals_deep (import cycle).
"""
from .funddeep_helpers import *  # noqa: F401,F403
from .funddeep_helpers import (_calc_cagr, _normalize_pct_field, _parse_num,
                               _screener_get, _sector_peers_from_universe)
from .funddeep_fetch import _fetch_universe_fallback, _fetch_yfinance_deep, _finalize_freshness_status
from .funddeep_scores import _calculate_altman_z_score, _calculate_intrinsic_dcf, _calculate_piotroski_f_score

def get_deep_financials(ticker: str) -> Dict[str, Any]:
    """
    Fetches comprehensive 10-Year Annual P&L, Balance Sheet, Cash Flows, Shareholding,
    dynamic CAGRs, Piotroski F-Score, Altman Z-Score, and DCF Intrinsic Fair Value.
    """
    ticker = ticker.upper().strip()
    cache_key = f"deep_fin_{ticker}"

    cached = cache_get(cache_key)
    if cached:
        return cached

    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")

    empty_profile = {
        "ticker": ticker,
        "name": ticker,
        "sector": "General",
        "about": f"{ticker} is a publicly traded entity listed on the National Stock Exchange of India (NSE).",
        # Neutral defaults. This profile is the floor every code path starts
        # from, so it must not claim verification before anything was parsed —
        # it used to ship "status": "Verified" and a Screener.in source label
        # even when the payload was empty or assembled from the reference
        # baseline. `_finalize_freshness_status` sets the real values from what
        # the payload actually contains.
        "data_freshness": {
            "last_updated": now_str,
            "data_source": "Unavailable",
            "status": "Unverified",
        },
        "quarterly_results": [],
        "annual_pl": [],
        "balance_sheet": [],
        "cash_flow": [],
        "ratios_cagr": {
            "sales_growth": {"3y": None, "5y": None, "10y": None},
            "profit_growth": {"3y": None, "5y": None, "10y": None},
            "stock_cagr": {"1y": None, "3y": None, "5y": None},
            "roe": {"3y": None, "5y": None, "last_year": None}
        },
        "shareholding": [],
        "peers": [],
        "piotroski_f_score": {"score": None, "max_score": 9, "rating": "INSUFFICIENT DATA", "summary": "Piotroski Score — insufficient data to evaluate.", "criteria": []},
        "altman_z_score": {"z_score": None, "zone": "Insufficient Data", "description": "Altman Z-Score not computable — required statements unavailable."},
        "dcf_valuation": {},
    }

    try:
        import requests
        from bs4 import BeautifulSoup

        url = f"https://www.screener.in/company/{ticker}/consolidated/"
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        }

        resp = _screener_get(url, headers=headers, timeout=8)
        if resp.status_code == 404:
            resp = _screener_get(f"https://www.screener.in/company/{ticker}/", headers=headers, timeout=6)

        data = dict(empty_profile)

        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            # The page loaded, so Screener.in is the source — but whether the
            # statements below actually parsed is decided by
            # `_finalize_freshness_status` at the end, not here.
            data["data_freshness"]["data_source"] = "Screener.in Consolidated (live scrape)"

            h1 = soup.find("h1")
            if h1:
                data["name"] = h1.get_text(strip=True)

            about_div = soup.find("div", class_="about")
            if about_div:
                p = about_div.find("p")
                if p:
                    data["about"] = p.get_text(strip=True)

            def _normalize_label(raw: str) -> str:
                cleaned = re.sub(r"[\+\s]+$", "", raw).strip()
                low = cleaned.lower()
                if "sales" in low or "revenue" in low:
                    return "Sales"
                if "expenses" in low:
                    return "Expenses"
                if "operating profit" in low:
                    return "Operating Profit"
                if "opm" in low:
                    return "OPM %"
                if "other income" in low:
                    return "Other Income"
                if "interest" in low:
                    return "Interest"
                if "depreciation" in low:
                    return "Depreciation"
                if "profit before tax" in low:
                    return "Profit before tax"
                if "tax" in low and "%" in low:
                    return "Tax %"
                if "net profit" in low:
                    return "Net Profit"
                if "eps" in low:
                    return "EPS in Rs"
                if "dividend payout" in low:
                    return "Dividend Payout %"
                if "borrowings" in low:
                    return "Borrowings"
                if "reserves" in low:
                    return "Reserves"
                if "equity capital" in low:
                    return "Equity Capital"
                if "other liabilities" in low:
                    return "Other Liabilities"
                if "total liabilities" in low:
                    return "Total Liabilities"
                if "fixed assets" in low:
                    return "Fixed Assets"
                if "investments" in low:
                    return "Investments"
                if "other assets" in low:
                    return "Other Assets"
                if "total assets" in low:
                    return "Total Assets"
                if "operating activity" in low or "cash from operating" in low:
                    return "Cash from Operating Activity"
                if "investing activity" in low or "cash from investing" in low:
                    return "Cash from Investing Activity"
                if "financing activity" in low or "cash from financing" in low:
                    return "Cash from Financing Activity"
                if "net cash flow" in low:
                    return "Net Cash Flow"
                return cleaned

            def parse_table_section(section_id: str) -> List[Dict[str, Any]]:
                sec = soup.find("section", id=section_id)
                if not sec:
                    return []
                table = sec.find("table")
                if not table:
                    return []
                headers = [th.get_text(strip=True) for th in table.find_all("tr")[0].find_all("th")[1:]]
                rows_data = []
                for row in table.find_all("tr")[1:]:
                    tds = row.find_all("td")
                    if not tds:
                        continue
                    row_label = _normalize_label(tds[0].get_text(strip=True))
                    values = [_parse_num(td.get_text(strip=True)) for td in tds[1:]]
                    rows_data.append({"metric": row_label, "values": values})

                periods_list = []
                for i, period_name in enumerate(headers):
                    period_obj = {"period": period_name}
                    for r in rows_data:
                        val = r["values"][i] if i < len(r["values"]) else None
                        period_obj[r["metric"]] = val
                        # Add normalized aliases
                        if r["metric"] == "Sales":
                            period_obj["revenue"] = val
                        elif r["metric"] == "Net Profit":
                            period_obj["net_profit"] = val
                        elif r["metric"] == "EPS in Rs":
                            period_obj["eps"] = val
                    periods_list.append(period_obj)
                return periods_list

            q_res = parse_table_section("quarters")
            if q_res:
                data["quarterly_results"] = q_res[-8:]

            pl_res = parse_table_section("profit-loss")
            if pl_res:
                data["annual_pl"] = pl_res[-10:]

            bs_res = parse_table_section("balance-sheet")
            if bs_res:
                data["balance_sheet"] = bs_res[-10:]

            cf_res = parse_table_section("cash-flow")
            if cf_res:
                data["cash_flow"] = cf_res[-10:]


            # Parse Shareholding Table
            sh_sec = soup.find("section", id="shareholding")
            if sh_sec:
                sh_table = sh_sec.find("table")
                if sh_table:
                    sh_headers = [th.get_text(strip=True) for th in sh_table.find_all("tr")[0].find_all("th")[1:]]
                    sh_rows = {}
                    for row in sh_table.find_all("tr")[1:]:
                        tds = row.find_all("td")
                        if tds:
                            # Normalize labels: Screener renders "Promoters +", "FIIs +", etc.
                            label = re.sub(r"[^a-z]", "", tds[0].get_text(strip=True).lower())
                            vals = [_parse_num(td.get_text(strip=True)) for td in tds[1:]]
                            sh_rows[label] = vals

                    def _pick_shareholding(*names):
                        for key, vals in sh_rows.items():
                            if any(n in key for n in names):
                                return vals
                        return []

                    prom_vals = _pick_shareholding("promoter")
                    fii_vals = _pick_shareholding("fii", "foreign")
                    dii_vals = _pick_shareholding("dii", "domestic")
                    pub_vals = _pick_shareholding("public")

                    sh_list = []
                    # Offset-safe slice: handles tickers with fewer than 6 quarters.
                    _sh_offset = max(0, len(sh_headers) - 6)
                    for i, qtr in enumerate(sh_headers[_sh_offset:]):  # Last 6 quarters
                        idx = _sh_offset + i
                        p_val = prom_vals[idx] if 0 <= idx < len(prom_vals) else None
                        f_val = fii_vals[idx] if 0 <= idx < len(fii_vals) else None
                        d_val = dii_vals[idx] if 0 <= idx < len(dii_vals) else None
                        pub_val = pub_vals[idx] if 0 <= idx < len(pub_vals) else None

                        # Skip quarters with no reported data rather than serving placeholders.
                        if p_val is None and f_val is None and d_val is None and pub_val is None:
                            continue

                        sh_list.append({
                            "quarter": qtr,
                            "promoter": p_val,
                            "fii": f_val,
                            "dii": d_val,
                            "public": pub_val,
                        })
                    if sh_list:
                        data["shareholding"] = sh_list

            # Parse Peers.
            # NOTE: Screener.in lazy-loads the peers table via AJAX into
            # #peers-table-placeholder — the static HTML no longer contains the
            # <table>. Parse the static table if present, else fetch the
            # dedicated peers fragment (/api/company/{warehouseId}/peers/).
            # IMPORTANT: the fragment needs the *warehouse* id from
            # #company-info[data-warehouse-id], NOT the company id from
            # /ai/company/{id}/ or data-row-company-id (that id serves a 404
            # page for the peers route).
            def _parse_peers_table(tbl) -> List[Dict[str, Any]]:
                parsed = []
                rows = tbl.find_all("tr")
                if len(rows) < 2:
                    return parsed
                # Header-driven column mapping (column order varies between layouts)
                ths = [th.get_text(strip=True).lower() for th in rows[0].find_all(["th", "td"])]

                def _col(*needles):
                    for i, htxt in enumerate(ths):
                        if any(n in htxt for n in needles):
                            return i
                    return None

                name_i = _col("company", "name")
                cmp_i = _col("cmp", "price")
                pe_i = _col("p/e", "pe")
                mcap_i = _col("mar cap", "market cap")
                roce_i = _col("roce")
                if name_i is None:
                    return parsed

                for row in rows[1:9]:
                    tds = row.find_all("td")
                    if len(tds) <= name_i:
                        continue

                    def _cell(i):
                        return _parse_num(tds[i].get_text(strip=True)) if (i is not None and i < len(tds)) else None

                    parsed.append({
                        "name": tds[name_i].get_text(strip=True),
                        "price": _cell(cmp_i),
                        "pe_ratio": _cell(pe_i),
                        "market_cap": _cell(mcap_i),
                        "roce": _cell(roce_i),
                        "source": "screener",
                    })
                return parsed

            peers_list: List[Dict[str, Any]] = []
            peers_sec = soup.find("section", id="peers")
            if peers_sec:
                peers_table = peers_sec.find("table")
                if peers_table:
                    peers_list = _parse_peers_table(peers_table)

            # Lazy-loaded AJAX fragment fallback (current Screener behaviour).
            # The loader (company.customisation.js → Utils.getUrl("peers"))
            # builds /api/company/{warehouseId}/peers/ from
            # #company-info[data-warehouse-id].
            if not peers_list:
                wh_id = None
                try:
                    info_el = soup.find(id="company-info")
                    if info_el and info_el.get("data-warehouse-id"):
                        wh_id = re.sub(r"\D", "", info_el.get("data-warehouse-id") or "")
                except Exception:
                    wh_id = None
                if not wh_id:
                    wh_fallback = re.search(r'data-warehouse-id="(\d+)"', resp.text)
                    if wh_fallback:
                        wh_id = wh_fallback.group(1)
                if wh_id:
                    try:
                        p_headers = dict(headers)
                        p_headers["Referer"] = url
                        p_headers["X-Requested-With"] = "XMLHttpRequest"
                        p_resp = _screener_get(
                            f"https://www.screener.in/api/company/{wh_id}/peers/",
                            headers=p_headers,
                            timeout=8,
                        )
                        if p_resp.status_code == 200 and "<table" in p_resp.text.lower():
                            p_soup = BeautifulSoup(p_resp.text, "html.parser")
                            p_table = p_soup.find("table")
                            if p_table:
                                peers_list = _parse_peers_table(p_table)
                    except Exception as peers_exc:
                        logger.debug("Peers fragment fetch failed for %s: %s", ticker, peers_exc)

            # Sector-universe fallback: when Screener yields no peers table,
            # derive peers from our own verified screener_daily_metrics
            # universe (same sector, largest market caps first). Real stored
            # metrics only — never synthesised rows.
            if not peers_list:
                try:
                    peers_list = _sector_peers_from_universe(ticker)
                except Exception as peers_exc:
                    logger.debug("Sector peers fallback failed for %s: %s", ticker, peers_exc)

            if peers_list:
                data["peers"] = peers_list

            # Zero-fake-data rule: when neither the Screener peers table nor
            # the sector-universe fallback yields peers, return an empty list.
            # The frontend already renders an EmptyState for this case — never
            # serve hardcoded "Industry Peer A/B" rows.
            if not data.get("peers"):
                data["peers"] = []

        else:
            # Fallback to yfinance deep
            yf_deep = _fetch_yfinance_deep(ticker)
            if yf_deep:
                for k, v in yf_deep.items():
                    if v:
                        data[k] = v
                data["data_freshness"]["data_source"] = "Yahoo Finance Real-Time"
            if not data.get("annual_pl") or not data.get("shareholding"):
                uni_fallback = _fetch_universe_fallback(ticker)
                if uni_fallback:
                    for k, v in uni_fallback.items():
                        # Only fill genuine gaps; empty statement lists stay empty
                        # so nothing invented can reach the CAGR block below.
                        if not data.get(k) and v:
                            data[k] = v
                    data["data_freshness"]["data_source"] = (
                        "StockOracle reference baseline (no verified statements)"
                    )

        # ── 2. Pure Dynamic CAGR Calculations (No Hardcoded Mock Numbers) ──
        annual_pl = data.get("annual_pl", [])
        if len(annual_pl) >= 2:
            s_curr = annual_pl[-1].get("Sales") or annual_pl[-1].get("revenue")
            p_curr = annual_pl[-1].get("Net Profit")

            # 3-Year CAGR
            if len(annual_pl) >= 4:
                s_3y = annual_pl[-4].get("Sales") or annual_pl[-4].get("revenue")
                p_3y = annual_pl[-4].get("Net Profit")
                data["ratios_cagr"]["sales_growth"]["3y"] = _calc_cagr(s_3y, s_curr, 3)
                data["ratios_cagr"]["profit_growth"]["3y"] = _calc_cagr(p_3y, p_curr, 3)

            # 5-Year CAGR
            if len(annual_pl) >= 6:
                s_5y = annual_pl[-6].get("Sales") or annual_pl[-6].get("revenue")
                p_5y = annual_pl[-6].get("Net Profit")
                data["ratios_cagr"]["sales_growth"]["5y"] = _calc_cagr(s_5y, s_curr, 5)
                data["ratios_cagr"]["profit_growth"]["5y"] = _calc_cagr(p_5y, p_curr, 5)

            # 10-Year CAGR
            if len(annual_pl) >= 10:
                s_10y = annual_pl[0].get("Sales") or annual_pl[0].get("revenue")
                p_10y = annual_pl[0].get("Net Profit")
                data["ratios_cagr"]["sales_growth"]["10y"] = _calc_cagr(s_10y, s_curr, 9)
                data["ratios_cagr"]["profit_growth"]["10y"] = _calc_cagr(p_10y, p_curr, 9)

        # ── 3. Piotroski F-Score (0-9) & Altman Z-Score ──
        data["piotroski_f_score"] = _calculate_piotroski_f_score(
            data.get("annual_pl", []),
            data.get("balance_sheet", []),
            data.get("cash_flow", [])
        )

        # Altman needs a real market-cap anchor. Prefer the base fundamentals
        # numeric market cap; fall back to the yfinance deep quote. No anchor →
        # honest "Insufficient Data" (never a synthetic multiple of assets).
        _alt_mcap = data.get("market_cap_cr")
        if _alt_mcap is None:
            try:
                from backend.data.fundamentals import get_fundamentals as _get_fund_base
                _fund_for_alt = _get_fund_base(ticker) or {}
                _alt_mcap = _fund_for_alt.get("market_cap_cr")
                if _alt_mcap is None and _fund_for_alt.get("market_cap"):
                    try:
                        _alt_mcap = float(str(_fund_for_alt["market_cap"]).replace(",", ""))
                    except (TypeError, ValueError):
                        _alt_mcap = None
            except Exception:
                _alt_mcap = None
        data["altman_z_score"] = _calculate_altman_z_score(
            data.get("annual_pl", []),
            data.get("balance_sheet", []),
            mcap_cr=_alt_mcap,
        )

        # ── 4. Ratio Trends (5-Year Historical for Sparklines) ──
        ratio_trends = []
        bs_list = data.get("balance_sheet", [])
        for i in range(len(annual_pl)):
            pl_row = annual_pl[i]
            bs_row = bs_list[i] if i < len(bs_list) else {}
            sales = float(pl_row.get("Sales") or pl_row.get("revenue") or 1.0)
            net_p = float(pl_row.get("Net Profit") or 0.0)
            ebit = float(pl_row.get("Operating Profit") or 0.0)
            equity = float(bs_row.get("Equity Capital") or 100.0)
            reserves = float(bs_row.get("Reserves") or 0.0)
            net_worth = equity + reserves
            borrowings = float(bs_row.get("Borrowings") or 0.0)
            capital_employed = net_worth + borrowings

            roce = round((ebit / max(1.0, capital_employed)) * 100.0, 1) if capital_employed > 0 else None
            roe = round((net_p / max(1.0, net_worth)) * 100.0, 1) if net_worth > 0 else None
            de = round(borrowings / max(1.0, net_worth), 2) if net_worth > 0 else None
            opm = pl_row.get("OPM %")

            ratio_trends.append({
                "period": pl_row.get("period"),
                "roce": roce,
                "roe": roe,
                "debt_to_equity": de,
                "opm": opm,
                "net_profit_margin": round((net_p / max(1.0, sales)) * 100.0, 1) if sales > 0 else None,
            })
        data["ratio_trends"] = ratio_trends[-5:]

        # ── 5. Corporate Calendar & Dividend Intelligence ──
        # Zero-fake-data rule: only real yfinance fields are served. Missing
        # fields stay None so the frontend renders "—" instead of stale dates.
        corp_calendar = {
            "upcoming_earnings_date": None,
            "ex_dividend_date": None,
            "dividend_yield_pct": None,
            "dividend_payout_ratio": None,
        }
        try:
            import yfinance as yf
            stock_obj = yf.Ticker(f"{ticker}.NS")
            inf = stock_obj.info or {}
            if inf.get("dividendYield") is not None:
                corp_calendar["dividend_yield_pct"] = _normalize_pct_field(inf.get("dividendYield"), digits=2)
            if inf.get("payoutRatio") is not None:
                corp_calendar["dividend_payout_ratio"] = _normalize_pct_field(inf.get("payoutRatio"), digits=1)
            if inf.get("exDividendDate"):
                try:
                    corp_calendar["ex_dividend_date"] = datetime.fromtimestamp(inf["exDividendDate"]).strftime("%d %b %Y")
                except Exception:
                    pass
            if inf.get("earningsDate") or inf.get("earningsTimestamp"):
                try:
                    _ed = inf.get("earningsDate") or inf.get("earningsTimestamp")
                    if isinstance(_ed, (list, tuple)):
                        _ed = _ed[0]
                    corp_calendar["upcoming_earnings_date"] = datetime.fromtimestamp(float(_ed)).strftime("%d %b %Y")
                except Exception:
                    pass
        except Exception:
            pass
        data["corporate_calendar"] = corp_calendar

        # ── 6. Intrinsic DCF & Fair Value Model ──
        # Zero-fake-data rule: no ₹1000 CMP anchor. Missing price stays None and
        # the DCF engine returns null margin/verdict instead of a fake comparison.
        try:
            from backend.data.fetcher import fetch_company_info
            cinfo = fetch_company_info(ticker) or {}
            _raw_cmp = cinfo.get("price")
            cmp = float(_raw_cmp) if _raw_cmp not in (None, "") else None
            if cmp is not None and (not math.isfinite(cmp) or cmp <= 0):
                cmp = None
        except Exception:
            cmp = None

        from backend.data.fundamentals import get_fundamentals
        fund_base = get_fundamentals(ticker) or {}
        eps = fund_base.get("eps")
        pb = fund_base.get("pb_ratio")
        book = fund_base.get("book_value")
        if book and book > 0:
            bvps = float(book)
        elif cmp and pb and pb > 0:
            bvps = (cmp / pb)
        else:
            bvps = None
        if fund_base.get("market_cap_cr") is not None:
            data["market_cap_cr"] = fund_base.get("market_cap_cr")

        data["dcf_valuation"] = _calculate_intrinsic_dcf(
            ticker,
            data.get("annual_pl", []),
            data.get("cash_flow", []),
            eps=eps,
            bvps=bvps,
            cmp=cmp,
        )

        _finalize_freshness_status(data)
        cache_set(cache_key, data, ttl_seconds=_CACHE_TTL)
        return data

    except Exception as exc:
        logger.warning("Deep financials scraper error for %s: %s", ticker, exc)
        data = dict(empty_profile)
        yf_deep = _fetch_yfinance_deep(ticker)
        if yf_deep:
            for k, v in yf_deep.items():
                if v:
                    data[k] = v
            data["data_freshness"]["data_source"] = "Yahoo Finance Fallback"

        # Tertiary fallback: Precomputed Database / Universe
        if not data.get("annual_pl") or not data.get("shareholding"):
            uni_fallback = _fetch_universe_fallback(ticker)
            if uni_fallback:
                for k, v in uni_fallback.items():
                    if not data.get(k) and v:
                        data[k] = v
                data["data_freshness"]["data_source"] = (
                    "StockOracle reference baseline (no verified statements)"
                )

        # Calculate CAGRs, Piotroski, Altman, and DCF if statements are present
        annual_pl = data.get("annual_pl", [])
        if len(annual_pl) >= 2:
            s_curr = annual_pl[-1].get("Sales") or annual_pl[-1].get("revenue")
            p_curr = annual_pl[-1].get("Net Profit")
            if len(annual_pl) >= 4:
                s_3y = annual_pl[-4].get("Sales") or annual_pl[-4].get("revenue")
                p_3y = annual_pl[-4].get("Net Profit")
                data["ratios_cagr"]["sales_growth"]["3y"] = _calc_cagr(s_3y, s_curr, 3)
                data["ratios_cagr"]["profit_growth"]["3y"] = _calc_cagr(p_3y, p_curr, 3)
            if len(annual_pl) >= 6:
                s_5y = annual_pl[-6].get("Sales") or annual_pl[-6].get("revenue")
                p_5y = annual_pl[-6].get("Net Profit")
                data["ratios_cagr"]["sales_growth"]["5y"] = _calc_cagr(s_5y, s_curr, 5)
                data["ratios_cagr"]["profit_growth"]["5y"] = _calc_cagr(p_5y, p_curr, 5)

        data["piotroski_f_score"] = _calculate_piotroski_f_score(
            data.get("annual_pl", []),
            data.get("balance_sheet", []),
            data.get("cash_flow", [])
        )

        _alt_mcap = data.get("market_cap_cr")
        data["altman_z_score"] = _calculate_altman_z_score(
            data.get("annual_pl", []),
            data.get("balance_sheet", []),
            mcap_cr=_alt_mcap,
        )

        cmp_val = data.get("cmp") or data.get("close_price")
        eps_val = data.get("eps")
        bvps_val = data.get("book_value")
        data["dcf_valuation"] = _calculate_intrinsic_dcf(
            ticker,
            data.get("annual_pl", []),
            data.get("cash_flow", []),
            eps=eps_val,
            bvps=bvps_val,
            cmp=cmp_val,
        )

        _finalize_freshness_status(data)
        cache_set(cache_key, data, ttl_seconds=_CACHE_TTL if data.get("annual_pl") else 600)
        return data

