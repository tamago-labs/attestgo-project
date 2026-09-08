export const CAUSES = [
  { id: "gift", label: "Gift" },
  { id: "payment", label: "Payment" },
  { id: "investment", label: "Investment" },
  { id: "loan", label: "Loan repayment" },
  { id: "refund", label: "Refund" },
  { id: "salary", label: "Salary" },
  { id: "dividend", label: "Dividend" },
  { id: "swap", label: "Swap" },
  { id: "other", label: "Other" },
] as const;

export type CauseId = (typeof CAUSES)[number]["id"];

export function buildEmailSubject(cause: CauseId, asset: string, amount: string): string {
  switch (cause) {
    case "gift": return `You received ${amount} ${asset}`;
    case "payment": return `Payment of ${amount} ${asset} received`;
    case "investment": return `Investment transfer: ${amount} ${asset}`;
    case "loan": return `Loan repayment: ${amount} ${asset}`;
    case "refund": return `Refund of ${amount} ${asset}`;
    case "salary": return `Salary payment: ${amount} ${asset}`;
    case "dividend": return `Dividend distribution: ${amount} ${asset}`;
    case "swap": return `Swap: ${amount} ${asset}`;
    default: return `You received ${amount} ${asset}`;
  }
}

export function buildEmailBody(params: {
  cause: CauseId;
  customNote?: string;
  senderName: string;
  recipientName: string;
  amount: string;
  asset: string;
  txHash?: string;
  hasDoc?: boolean;
}): string {
  const { cause, customNote, senderName, recipientName, amount, asset, txHash, hasDoc } = params;

  const greeting = `Hi ${recipientName},`;
  const closing = `Best,\n${senderName}`;

  let body = "";
  switch (cause) {
    case "gift":
      body = `${senderName} sent you ${amount} ${asset} as a gift.`;
      break;
    case "payment":
      body = `${senderName} sent you ${amount} ${asset} as a payment.`;
      break;
    case "investment":
      body = `${senderName} transferred ${amount} ${asset} as an investment.`;
      break;
    case "loan":
      body = `${senderName} sent ${amount} ${asset} as a loan repayment.`;
      break;
    default:
      body = `${senderName} sent you ${amount} ${asset}.`;
  }

  if (customNote) {
    body += `\n\nNote: ${customNote}`;
  }

  if (txHash) {
    body += `\n\nTransaction: ${txHash}`;
  }

  if (hasDoc) {
    body += `\n\nSupporting document attached.`;
  }

  return `${greeting}\n\n${body}\n\n${closing}`;
}


export const DEFAULT_TEMPLATES: Record<CauseId, string> = {
  gift: `Hi {{recipientName}},

{{senderName}} has sent you {{amount}} {{asset}} as a gift.

This transfer was made as a personal gift from {{senderName}} to you.

Best regards,
{{senderName}}`,

  payment: `Hi {{recipientName}},

{{senderName}} has sent you {{amount}} {{asset}} as payment.

This transfer is intended as payment for the agreed goods, services, or other arrangement between both parties.

Best regards,
{{senderName}}`,

  investment: `Hi {{recipientName}},

{{senderName}} has transferred {{amount}} {{asset}} in connection with an investment.

This transfer is intended for the agreed investment or funding arrangement between both parties.

Best regards,
{{senderName}}`,

  loan: `Hi {{recipientName}},

{{senderName}} has sent you {{amount}} {{asset}} as a loan repayment.

This transfer represents repayment under the agreed lending arrangement between both parties.

Best regards,
{{senderName}}`,

  other: `Hi {{recipientName}},

{{senderName}} has sent you {{amount}} {{asset}}.

This transfer was made for the purpose agreed between {{senderName}} and you.

Best regards,
{{senderName}}`,

  refund: `Hi {{recipientName}},

{{senderName}} has issued you a refund of {{amount}} {{asset}}.

This transfer represents a refund related to a previous payment or transaction.

Best regards,
{{senderName}}`,

  salary: `Hi {{recipientName}},

{{senderName}} has sent you {{amount}} {{asset}} as salary.

This transfer represents salary or compensation for the agreed work or services provided.

Best regards,
{{senderName}}`,

  dividend: `Hi {{recipientName}},

{{senderName}} has distributed {{amount}} {{asset}} as a dividend or investment yield.

This transfer represents a distribution associated with your investment or asset holding.

Best regards,
{{senderName}}`,

  swap: `Hi {{recipientName}},

{{senderName}} has transferred {{amount}} {{asset}} as part of an asset swap.

This transfer forms part of the agreed exchange between both parties.

Best regards,
{{senderName}}`,
}; 


export function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
