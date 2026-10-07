const MAX_SCRIPT_LENGTH = 12000;
const MAX_SCRIPT_LINES = 120;
const MAX_PLOTS = 6;
const MAX_PERIOD = 5000;
const DEFAULT_COLOR = '#38BDF8';

function stripLineComment(source) {
  let quote = null;
  for (let i = 0; i < source.length; i += 1) {
    if (quote) {
      if (source[i] === '\\') {
        i += 1;
      } else if (source[i] === quote) {
        quote = null;
      }
    } else if (source[i] === '"' || source[i] === "'") {
      quote = source[i];
    } else if (source[i] === '/' && source[i + 1] === '/') {
      return source.slice(0, i);
    }
  }
  return source;
}

function tokenize(source, line) {
  const tokens = [];
  let offset = 0;
  let nesting = 0;
  while (offset < source.length) {
    const rest = source.slice(offset);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      offset += whitespace[0].length;
      continue;
    }
    const match = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)|^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|^[A-Za-z_]\w*|^(?:==|!=|<=|>=|[+\-*/%(),.=<>])/);
    if (!match) throw new Error(`Line ${line}: unexpected character "${rest[0]}"`);
    tokens.push(match[0]);
    if (match[0] === '(') {
      nesting += 1;
      if (nesting > 64) throw new Error(`Line ${line}: expressions cannot be nested more than 64 levels`);
    } else if (match[0] === ')') {
      nesting -= 1;
    }
    offset += match[0].length;
    if (tokens.length > 2000) throw new Error(`Line ${line}: script is too complex`);
  }
  return tokens;
}

class ExpressionParser {
  constructor(tokens, line) {
    this.tokens = tokens;
    this.index = 0;
    this.line = line;
  }

  peek() {
    return this.tokens[this.index];
  }

  take() {
    return this.tokens[this.index++];
  }

  expect(value) {
    if (this.take() !== value) throw new Error(`Line ${this.line}: expected "${value}"`);
  }

  parseArguments() {
    const args = [];
    const options = {};
    if (this.peek() === ')') return { args, options };
    while (this.index < this.tokens.length) {
      if (
        /^[A-Za-z_]\w*$/.test(this.peek() || '') &&
        this.tokens[this.index + 1] === '='
      ) {
        const key = this.take();
        this.take();
        options[key] = this.parseExpression();
      } else {
        args.push(this.parseExpression());
      }
      if (this.peek() !== ',') break;
      this.take();
    }
    return { args, options };
  }

  parseExpression(minPrecedence = 0) {
    let left;
    const token = this.take();
    if (token === undefined) throw new Error(`Line ${this.line}: expected an expression`);
    if (token === '+' || token === '-') {
      left = { type: 'unary', operator: token, value: this.parseExpression(5) };
    } else if (token === '(') {
      left = this.parseExpression();
      this.expect(')');
    } else if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) {
      left = { type: 'number', value: Number(token) };
    } else if (/^["']/.test(token)) {
      left = { type: 'string', value: token.slice(1, -1) };
    } else if (/^[A-Za-z_]\w*$/.test(token)) {
      let name = token;
      while (this.peek() === '.') {
        this.take();
        const part = this.take();
        if (!/^[A-Za-z_]\w*$/.test(part || '')) {
          throw new Error(`Line ${this.line}: expected a name after "."`);
        }
        name += `.${part}`;
      }
      if (this.peek() === '(') {
        this.take();
        const { args, options } = this.parseArguments();
        this.expect(')');
        left = { type: 'call', name, args, options };
      } else {
        left = { type: 'identifier', name };
      }
    } else {
      throw new Error(`Line ${this.line}: unexpected token "${token}"`);
    }

    const precedence = { '==': 1, '!=': 1, '<': 1, '<=': 1, '>': 1, '>=': 1, '+': 2, '-': 2, '*': 3, '/': 3, '%': 3 };
    while (precedence[this.peek()] != null && precedence[this.peek()] >= minPrecedence) {
      const operator = this.take();
      const nextPrecedence = precedence[operator] + 1;
      left = { type: 'binary', operator, left, right: this.parseExpression(nextPrecedence) };
    }
    return left;
  }
}

function parseScript(script) {
  if (typeof script !== 'string' || !script.trim()) throw new Error('Write an indicator script first.');
  if (script.length > MAX_SCRIPT_LENGTH) throw new Error(`Scripts must be ${MAX_SCRIPT_LENGTH} characters or fewer.`);
  const lines = script.split(/\r?\n/);
  if (lines.length > MAX_SCRIPT_LINES) throw new Error(`Scripts must be ${MAX_SCRIPT_LINES} lines or fewer.`);

  const assignments = [];
  const plots = [];
  for (let index = 0; index < lines.length; index += 1) {
    const source = stripLineComment(lines[index]).trim();
    if (!source || source.startsWith('#') || source.startsWith('//@version')) continue;
    const tokens = tokenize(source, index + 1);
    if (tokens[0] === 'indicator' || tokens[0] === 'study') {
      const parser = new ExpressionParser(tokens, index + 1);
      parser.parseExpression();
      if (parser.index !== tokens.length) throw new Error(`Line ${index + 1}: invalid indicator declaration`);
      continue;
    }
    const assignmentName = tokens[0];
    if (/^[A-Za-z_]\w*$/.test(assignmentName || '') && tokens[1] === '=') {
      const parser = new ExpressionParser(tokens.slice(2), index + 1);
      const expression = parser.parseExpression();
      if (parser.index !== tokens.length - 2) throw new Error(`Line ${index + 1}: unexpected input after expression`);
      assignments.push({ name: assignmentName, expression, line: index + 1 });
      continue;
    }
    const parser = new ExpressionParser(tokens, index + 1);
    const expression = parser.parseExpression();
    if (parser.index !== tokens.length) throw new Error(`Line ${index + 1}: unexpected input after expression`);
    if (expression.type !== 'call' || expression.name !== 'plot' || expression.args.length !== 1) {
      throw new Error(`Line ${index + 1}: expected an assignment or plot(expression, title="...", color="#RRGGBB")`);
    }
    const title = expression.options.title;
    const color = expression.options.color;
    if (title && title.type !== 'string') throw new Error(`Line ${index + 1}: plot title must be a string`);
    if (color && color.type !== 'string') throw new Error(`Line ${index + 1}: plot color must be a string`);
    const plotColor = color?.value || DEFAULT_COLOR;
    if (!/^#[\da-f]{6}$/i.test(plotColor)) {
      throw new Error(`Line ${index + 1}: plot color must be a six-digit hex color (for example #2962FF)`);
    }
    plots.push({ expression: expression.args[0], title: title?.value || `Plot ${plots.length + 1}`, color: plotColor, line: index + 1 });
    if (plots.length > MAX_PLOTS) throw new Error(`An indicator can contain at most ${MAX_PLOTS} plots.`);
  }
  if (!plots.length) throw new Error('Add at least one plot(expression) line.');
  return { assignments, plots };
}

const toArray = (value, length) => Array.isArray(value) ? value : Array(length).fill(value);
const finiteOrNull = (value) => Number.isFinite(value) ? value : null;
const scalar = (node, env, line) => {
  if (node.type === 'number') return node.value;
  if (node.type === 'string') return node.value;
  if (node.type === 'identifier') {
    if (Object.prototype.hasOwnProperty.call(env, node.name)) return env[node.name];
    throw new Error(`Line ${line}: unknown variable "${node.name}"`);
  }
  if (node.type === 'unary') {
    const value = scalar(node.value, env, line);
    if (typeof value !== 'number') throw new Error(`Line ${line}: expected a number`);
    return node.operator === '-' ? -value : value;
  }
  throw new Error(`Line ${line}: expected a number or input value`);
};

function evaluate(node, env, candles, line) {
  const length = candles.length;
  if (node.type === 'number' || node.type === 'string') return node.value;
  if (node.type === 'identifier') {
    if (!Object.prototype.hasOwnProperty.call(env, node.name)) {
      throw new Error(`Line ${line}: unknown variable "${node.name}"`);
    }
    return env[node.name];
  }
  if (node.type === 'unary') {
    const source = toArray(evaluate(node.value, env, candles, line), length);
    return source.map((value) => value == null ? null : finiteOrNull(node.operator === '-' ? -value : value));
  }
  if (node.type === 'binary') {
    const left = toArray(evaluate(node.left, env, candles, line), length);
    const right = toArray(evaluate(node.right, env, candles, line), length);
    const ops = {
      '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b,
      '/': (a, b) => b === 0 ? null : a / b, '%': (a, b) => b === 0 ? null : a % b,
      '==': (a, b) => Number(a === b), '!=': (a, b) => Number(a !== b),
      '<': (a, b) => Number(a < b), '<=': (a, b) => Number(a <= b),
      '>': (a, b) => Number(a > b), '>=': (a, b) => Number(a >= b),
    };
    return left.map((value, index) => {
      const other = right[index];
      if (value == null || other == null) return null;
      return finiteOrNull(ops[node.operator](value, other));
    });
  }
  if (node.type === 'call') {
    const name = node.name.replace(/^ta\./, '');
    if (name === 'input' || name === 'input.int' || name === 'input.float') {
      if (node.args.length < 1) throw new Error(`Line ${line}: input() needs a default value`);
      const value = scalar(node.args[0], env, line);
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Line ${line}: input default must be numeric`);
      return value;
    }
    const args = node.args.map((arg) => evaluate(arg, env, candles, line));
    const series = toArray(args[0], length);
    if (name === 'sma' || name === 'ema' || name === 'rsi') {
      if (args.length !== 2) throw new Error(`Line ${line}: ${node.name}() expects a source and period`);
      const period = Number(args[1]);
      if (!Number.isInteger(period) || period < 1 || period > MAX_PERIOD) {
        throw new Error(`Line ${line}: period must be an integer between 1 and ${MAX_PERIOD}`);
      }
      if (name === 'sma') {
        let sum = 0;
        let count = 0;
        return series.map((value, index) => {
          if (value != null) {
            sum += value;
            count += 1;
          }
          const expired = index - period;
          if (expired >= 0 && series[expired] != null) {
            sum -= series[expired];
            count -= 1;
          }
          return count ? sum / count : null;
        });
      }
      if (name === 'ema') {
        const alpha = 2 / (period + 1);
        let previous = null;
        return series.map((value) => {
          if (value == null) return null;
          previous = previous == null ? value : (value * alpha) + (previous * (1 - alpha));
          return previous;
        });
      }
      let previous = null;
      let avgGain = 0;
      let avgLoss = 0;
      return series.map((value, index) => {
        if (value == null || index === 0 || series[index - 1] == null) return null;
        const change = value - series[index - 1];
        avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
        previous = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
        return previous;
      });
    }
    const unaryFunctions = {
      abs: Math.abs, 'math.abs': Math.abs, sqrt: Math.sqrt, 'math.sqrt': Math.sqrt,
      log: Math.log, 'math.log': Math.log, exp: Math.exp, 'math.exp': Math.exp,
      floor: Math.floor, 'math.floor': Math.floor, ceil: Math.ceil, 'math.ceil': Math.ceil,
      round: Math.round, 'math.round': Math.round,
    };
    const binaryFunctions = { min: Math.min, 'math.min': Math.min, max: Math.max, 'math.max': Math.max };
    if (unaryFunctions[name]) {
      if (args.length !== 1) throw new Error(`Line ${line}: ${node.name}() expects one value`);
      return toArray(args[0], length).map((value) => value == null ? null : finiteOrNull(unaryFunctions[name](value)));
    }
    if (binaryFunctions[name]) {
      if (args.length !== 2) throw new Error(`Line ${line}: ${node.name}() expects two series values`);
      const other = toArray(args[1], length);
      return series.map((value, index) => value == null || other[index] == null ? null : finiteOrNull(binaryFunctions[name](value, other[index])));
    }
    throw new Error(`Line ${line}: unsupported function "${node.name}"`);
  }
  throw new Error(`Line ${line}: unsupported expression`);
}

export function validateCustomIndicatorScript(script) {
  try {
    calculateCustomIndicator(script, [{ time: 0, open: 1, high: 2, low: 1, close: 2, volume: 1 }]);
    return { valid: true, error: '' };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

export function calculateCustomIndicator(script, candles) {
  const { assignments, plots } = parseScript(script);
  if (!Array.isArray(candles) || candles.length === 0) return plots.map((plot) => ({ ...plot, data: [] }));
  const env = {};
  for (const field of ['open', 'high', 'low', 'close', 'volume']) {
    env[field] = candles.map((candle) => {
      if (candle[field] == null) return null;
      const value = Number(candle[field]);
      return Number.isFinite(value) ? value : null;
    });
  }
  env.hl2 = candles.map((candle) => candle.high == null || candle.low == null ? null : (Number(candle.high) + Number(candle.low)) / 2);
  env.hlc3 = candles.map((candle) => candle.high == null || candle.low == null || candle.close == null ? null : (Number(candle.high) + Number(candle.low) + Number(candle.close)) / 3);
  env.ohlc4 = candles.map((candle) => ['open', 'high', 'low', 'close'].some((field) => candle[field] == null) ? null : (Number(candle.open) + Number(candle.high) + Number(candle.low) + Number(candle.close)) / 4);

  for (const assignment of assignments) {
    if (Object.prototype.hasOwnProperty.call(env, assignment.name)) {
      throw new Error(`Line ${assignment.line}: cannot overwrite built-in "${assignment.name}"`);
    }
    env[assignment.name] = evaluate(assignment.expression, env, candles, assignment.line);
  }
  return plots.map((plot) => ({
    title: plot.title,
    color: plot.color,
    data: toArray(evaluate(plot.expression, env, candles, plot.line), candles.length)
      .map((value, index) => {
        if (value == null) return null;
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new Error(`Line ${plot.line}: plot() must return numeric values`);
        }
        return { time: candles[index].time, value };
      })
      .filter(Boolean),
  }));
}
