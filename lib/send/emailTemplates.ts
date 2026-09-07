export const CAUSES = [
  { id: "gift", label: "Gift" },
  { id: "payment", label: "Payment" },
  { id: "investment", label: "Investment" },
  { id: "loan", label: "Loan repayment" },
  { id: "other", label: "Other" },
] as const;

export type CauseId = (typeof CAUSES)[number]["id"];

export function buildEmailSubject(cause: CauseId, asset: string, amount: string): string {
  switch (cause) {
    case "gift": return `You received ${amount} ${asset}`;
    case "payment": return `Payment of ${amount} ${asset} received`;
    case "investment": return `Investment transfer: ${amount} ${asset}`;
    case "loan": return `Loan repayment: ${amount} ${asset}`;
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

{{senderName}} sent you {{amount}} {{asset}} as a gift.

Best,
AttestGO Protocol`,
  payment: `Hi {{recipientName}},

{{senderName}} sent you {{amount}} {{asset}} as a payment.

Best,
AttestGO Protocol`,
  investment: `Hi {{recipientName}},

{{senderName}} transferred {{amount}} {{asset}} as an investment.

Best,
AttestGO Protocol`,
  loan: `Hi {{recipientName}},

{{senderName}} sent {{amount}} {{asset}} as a loan repayment.

Best,
AttestGO Protocol`,
  other: `Hi {{recipientName}},

{{senderName}} sent you {{amount}} {{asset}}.

Best,
AttestGO Protocol`,
};

export function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
