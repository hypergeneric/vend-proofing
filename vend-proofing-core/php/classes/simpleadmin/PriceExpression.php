<?php

	/** Deterministic pricing arithmetic. Never evaluates PHP or JavaScript source. */
	class PriceExpression {
		private array $tokens;
		private int $position = 0;
		private array $variables;

		public static function evaluate (string $expression, float $area=0, float $quantity=0, float $price=0): float {
			$parser = new self($expression, array("A" => $area, "Q" => $quantity, "P" => $price));
			$result = $parser->expression();
			if ($parser->peek()!==null || !is_finite($result) || abs($result)>100000000) {
				throw new InvalidArgumentException("invalid_pricing_formula");
			}
			return $result;
		}

		private function __construct (string $expression, array $variables) {
			$expression = trim($expression)==="" ? "0" : trim($expression);
			if (strlen($expression)>1000) throw new InvalidArgumentException("invalid_pricing_formula");
			preg_match_all('/(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?|(?:Math\.)?[A-Za-z_][A-Za-z_0-9]*|\*\*|<=|>=|==|!=|&&|\|\||[+*\/%(),?:<>!\-]/', $expression, $matches);
			if (preg_replace('/\s+/', '', implode('', $matches[0]))!==preg_replace('/\s+/', '', $expression)
				|| count($matches[0])>200) throw new InvalidArgumentException("invalid_pricing_formula");
			$this->tokens = $matches[0];
			$this->variables = $variables;
		}

		private function peek (): ?string {
			return $this->tokens[$this->position] ?? null;
		}

		private function take (string $token): bool {
			if ($this->peek()!==$token) return false;
			$this->position++;
			return true;
		}

		private function require (string $token): void {
			if (!$this->take($token)) throw new InvalidArgumentException("invalid_pricing_formula");
		}

		private function expression (int $minimum=0, bool $evaluate=true): float {
			$token = $this->tokens[$this->position++] ?? null;
			if ($token===null) throw new InvalidArgumentException("invalid_pricing_formula");
			if (in_array($token, array("+", "-", "!"), true)) {
				$operand = $this->expression(7, $evaluate);
				$value = $token==="-" ? -$operand : ($token==="!" ? (float) !$operand : $operand);
			} elseif ($token==="(") {
				$value = $this->expression(0, $evaluate);
				$this->require(")");
			} elseif (is_numeric($token)) {
				$value = (float) $token;
			} else {
				$name = str_starts_with($token, "Math.") ? substr($token, 5) : $token;
				$constants = array("PI" => M_PI, "E" => M_E, "LN2" => M_LN2, "LN10" => M_LN10,
					"LOG2E" => M_LOG2E, "LOG10E" => M_LOG10E, "SQRT2" => M_SQRT2, "SQRT1_2" => M_SQRT1_2);
				if (isset($this->variables[$name])) $value = $this->variables[$name];
				elseif (isset($constants[$name])) $value = $constants[$name];
				else {
					$this->require("(");
					$args = array($this->expression(0, $evaluate));
					while ($this->take(",")) $args[] = $this->expression(0, $evaluate);
					$this->require(")");
					$unary = array("abs", "acos", "asin", "atan", "ceil", "cos", "exp", "floor", "log", "sin", "sqrt", "tan");
					if (in_array($name, $unary, true) && count($args)===1) $value = $evaluate ? $name($args[0]) : 0;
					elseif ($name==="round" && count($args)===1) $value = $evaluate ? floor($args[0] + 0.5) : 0;
					elseif (in_array($name, array("min", "max"), true)) $value = $evaluate ? $name($args) : 0;
					elseif (in_array($name, array("pow", "atan2"), true) && count($args)===2) $value = $evaluate ? $name(...$args) : 0;
					else throw new InvalidArgumentException("invalid_pricing_formula");
				}
			}
			$precedence = array("||" => 1, "&&" => 2, "==" => 3, "!=" => 3, "<" => 4, ">" => 4,
				"<=" => 4, ">=" => 4, "+" => 5, "-" => 5, "*" => 6, "/" => 6, "%" => 6, "**" => 8);
			while (($operator = $this->peek())!==null && isset($precedence[$operator]) && $precedence[$operator]>=$minimum) {
				$this->position++;
				$rightEnabled = $evaluate && !(($operator==="&&" && !$value) || ($operator==="||" && $value));
				$right = $this->expression($precedence[$operator] + ($operator==="**" ? 0 : 1), $rightEnabled);
				if (!$evaluate) { $value = 0; continue; }
				if (($operator==="/" || $operator==="%") && $right==0) throw new InvalidArgumentException("invalid_pricing_formula");
				$value = match ($operator) {
					"+" => $value + $right, "-" => $value - $right, "*" => $value * $right,
					"/" => $value / $right, "%" => fmod($value, $right), "**" => $value ** $right,
					"<" => (float) ($value < $right), ">" => (float) ($value > $right),
					"<=" => (float) ($value <= $right), ">=" => (float) ($value >= $right),
					"==" => (float) ($value == $right), "!=" => (float) ($value != $right),
					"&&" => $value ? $right : $value, "||" => $value ? $value : $right
				};
			}
			if ($minimum===0 && $this->take("?")) {
				$yes = $this->expression(0, $evaluate && (bool) $value);
				$this->require(":");
				$no = $this->expression(0, $evaluate && !(bool) $value);
				$value = $value ? $yes : $no;
			}
			return (float) $value;
		}
	}
