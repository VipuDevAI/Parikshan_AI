import { useMemo } from "react";

interface MathTextProps {
  text: string;
  className?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function MathText({ text, className = "" }: MathTextProps) {
  const renderedContent = useMemo(() => {
    if (!text) return escapeHtml(text || "");
    
    let result = escapeHtml(text);
    
    result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '<span class="inline-flex flex-col items-center mx-1"><span class="border-b border-current px-1">$1</span><span class="px-1">$2</span></span>');
    
    result = result.replace(/\\sqrt\{([^}]+)\}/g, '<span class="inline-flex items-baseline"><span class="text-lg mr-0.5">&#8730;</span><span class="border-t border-current px-1">$1</span></span>');
    
    result = result.replace(/\^(\d+|\{[^}]+\})/g, (_, exp) => {
      const content = exp.startsWith("{") ? exp.slice(1, -1) : exp;
      return `<sup class="text-xs">${content}</sup>`;
    });
    
    result = result.replace(/_(\d+|\{[^}]+\})/g, (_, sub) => {
      const content = sub.startsWith("{") ? sub.slice(1, -1) : sub;
      return `<sub class="text-xs">${content}</sub>`;
    });
    
    result = result.replace(/\\pi/g, "π");
    result = result.replace(/\\theta/g, "θ");
    result = result.replace(/\\alpha/g, "α");
    result = result.replace(/\\beta/g, "β");
    result = result.replace(/\\gamma/g, "γ");
    result = result.replace(/\\delta/g, "δ");
    result = result.replace(/\\epsilon/g, "ε");
    result = result.replace(/\\sigma/g, "σ");
    result = result.replace(/\\omega/g, "ω");
    result = result.replace(/\\lambda/g, "λ");
    result = result.replace(/\\mu/g, "μ");
    result = result.replace(/\\phi/g, "φ");
    result = result.replace(/\\psi/g, "ψ");
    
    result = result.replace(/\\times/g, "×");
    result = result.replace(/\\div/g, "÷");
    result = result.replace(/\\pm/g, "±");
    result = result.replace(/\\leq/g, "≤");
    result = result.replace(/\\geq/g, "≥");
    result = result.replace(/\\neq/g, "≠");
    result = result.replace(/\\approx/g, "≈");
    result = result.replace(/\\infty/g, "∞");
    result = result.replace(/\\sum/g, "∑");
    result = result.replace(/\\prod/g, "∏");
    result = result.replace(/\\int/g, "∫");
    result = result.replace(/\\rightarrow/g, "→");
    result = result.replace(/\\leftarrow/g, "←");
    result = result.replace(/\\Rightarrow/g, "⇒");
    result = result.replace(/\\Leftarrow/g, "⇐");
    result = result.replace(/\\degree/g, "°");
    
    return result;
  }, [text]);

  return (
    <span 
      className={`math-text ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
}

export function formatMathForPrint(text: string): string {
  if (!text) return "";
  
  let result = text;
  
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)");
  result = result.replace(/\\sqrt\{([^}]+)\}/g, "sqrt($1)");
  
  result = result.replace(/\^(\d+)/g, "^$1");
  result = result.replace(/\^\{([^}]+)\}/g, "^($1)");
  result = result.replace(/_(\d+)/g, "_$1");
  result = result.replace(/_\{([^}]+)\}/g, "_($1)");
  
  result = result.replace(/\\pi/g, "π");
  result = result.replace(/\\theta/g, "θ");
  result = result.replace(/\\alpha/g, "α");
  result = result.replace(/\\beta/g, "β");
  result = result.replace(/\\gamma/g, "γ");
  result = result.replace(/\\delta/g, "δ");
  result = result.replace(/\\epsilon/g, "ε");
  result = result.replace(/\\sigma/g, "σ");
  result = result.replace(/\\omega/g, "ω");
  result = result.replace(/\\lambda/g, "λ");
  result = result.replace(/\\mu/g, "μ");
  result = result.replace(/\\phi/g, "φ");
  result = result.replace(/\\psi/g, "ψ");
  
  result = result.replace(/\\times/g, "×");
  result = result.replace(/\\div/g, "÷");
  result = result.replace(/\\pm/g, "±");
  result = result.replace(/\\leq/g, "≤");
  result = result.replace(/\\geq/g, "≥");
  result = result.replace(/\\neq/g, "≠");
  result = result.replace(/\\approx/g, "≈");
  result = result.replace(/\\infty/g, "∞");
  result = result.replace(/\\sum/g, "Σ");
  result = result.replace(/\\prod/g, "Π");
  result = result.replace(/\\int/g, "∫");
  result = result.replace(/\\rightarrow/g, "→");
  result = result.replace(/\\leftarrow/g, "←");
  result = result.replace(/\\Rightarrow/g, "⇒");
  result = result.replace(/\\Leftarrow/g, "⇐");
  result = result.replace(/\\degree/g, "°");
  
  return result;
}