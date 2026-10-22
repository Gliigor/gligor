// What the AI reader must return for each document type. The model only
// transcribes figures; every calculation stays in our own code.
// Deliberately absent: BSN, addresses, bank account numbers and other
// identifiers. They are not needed for a plan, so they are never requested.

import { z } from "zod";

const amount = (what: string) =>
  z
    .object({
      value: z.number().nullable().describe(`${what}. Whole euros as printed, without separators. null when not in the document.`),
      page: z.number().nullable().describe("1-based page of the uploaded file where this value is printed. null when unsure."),
    })
    .describe(what);

const year = (what: string) =>
  z.object({
    value: z.number().nullable().describe(`${what} (four digits). null when not in the document.`),
    page: z.number().nullable().describe("1-based page where this is printed. null when unsure."),
  });

const owner = z
  .enum(["taxpayer", "partner", "joint", "unknown"])
  .describe("Whose item this is in the return: the taxpayer (aangever), the fiscal partner, both (joint), or unknown.");

const employments = (whose: string) =>
  z
    .array(
      z.object({
        payer: z.string().describe("Name of the employer or benefits agency (inhoudingsplichtige)."),
        isOwnCompany: z.boolean().describe(`True when this is a BV in which the ${whose} holds a substantial interest (DGA-salaris).`),
        grossWage: amount("Fiscal wage (fiscaal loon) from this payer for the year"),
      }),
    )
    .describe(`Box 1 income from employment and benefits of the ${whose}: one entry per payer, exactly as listed. Empty when none.`);

export const ibAangifteSchema = z.object({
  taxYear: z.number().nullable().describe("Belastingjaar of the return, e.g. 2025."),
  taxpayer: z.object({
    birthYear: year("Birth year of the taxpayer (aangever)"),
    employments: employments("taxpayer"),
  }),
  partner: z.object({
    present: z.boolean().describe("Whether the return names a fiscal partner."),
    firstName: z.string().nullable().describe("First name of the fiscal partner only, no surname. null when absent."),
    relationship: z
      .enum(["married_or_registered", "cohabiting", "unknown"])
      .describe("Married / registered partnership, or cohabiting fiscal partners."),
    birthYear: year("Birth year of the fiscal partner"),
    employments: employments("fiscal partner"),
  }),
  home: z.object({
    present: z.boolean().describe("Whether the return contains an owner-occupied home (eigen woning)."),
    wozValue: amount("WOZ-waarde of the eigen woning"),
    owner,
  }),
  mortgageParts: z
    .array(
      z.object({
        description: z.string().describe("Lender and/or loan part, e.g. 'ING leningdeel 2'."),
        balance: amount("Outstanding eigenwoningschuld of this loan part at 31 December"),
        interestPaid: amount("Mortgage interest paid on this loan part during the year"),
        interestRatePercent: z.object({
          value: z.number().nullable().describe("Interest rate in percent (3.9 for 3.9%), only when printed. null otherwise."),
          page: z.number().nullable(),
        }),
        repaymentType: z.enum(["annuity", "linear", "interest_only", "unknown"]),
      }),
    )
    .describe("One entry per loan part of the eigenwoningschuld. Empty when there is none."),
  box3Items: z
    .array(
      z.object({
        category: z
          .enum(["bank_savings", "investments", "real_estate", "other_assets", "debt"])
          .describe(
            "bank_savings = bank- en spaartegoeden; investments = beleggingen (shares, funds, green investments); real_estate = onroerende zaken in Nederland other than the own home; other_assets = overige bezittingen (claims, loans given, crypto); debt = schulden in box 3",
          ),
        description: z.string().describe("Name of the account, institution or object. No account numbers."),
        value: amount("Value on 1 January of the tax year (peildatum). Debts as a positive amount"),
        owner,
      }),
    )
    .describe("One entry per box 3 item listed in the return. Empty when none."),
  substantialInterests: z
    .array(
      z.object({
        companyName: z.string().describe("Name of the BV."),
        sharePercentage: z.object({
          value: z.number().nullable().describe("Shareholding in percent, e.g. 100."),
          page: z.number().nullable(),
        }),
        dividendReceived: amount("Regular benefits (dividend) received from this BV in the year"),
        holder: owner,
      }),
    )
    .describe("Box 2: one entry per company in which a substantial interest (aanmerkelijk belang) is held. Empty when none."),
  // Totals as printed, so our own code can check the items above add up.
  box3TotalsPrinted: z
    .array(
      z.object({
        owner,
        assets: amount("Total of the box 3 assets (totaal bezittingen) printed for this person"),
        debts: amount("Total of the box 3 debts printed for this person, before the debt threshold (schuldendrempel)"),
      }),
    )
    .describe("Every box 3 total line printed in the return, usually one per person. Copy them; do not add up anything yourself. Empty when none is printed."),
  mortgageTotalPrinted: amount("Total eigenwoningschuld at 31 December as printed on a total line. null when no total line is printed"),
  notes: z
    .array(z.string())
    .describe("Short remarks in Dutch for the financial planner: ambiguous or unreadable values, items that did not fit the fields above."),
});

export type IbAangifteExtraction = z.infer<typeof ibAangifteSchema>;

export const jaarrekeningSchema = z.object({
  financialYear: z.number().nullable().describe("Boekjaar of the annual accounts."),
  companyName: z.string().nullable().describe("Name of the BV."),
  equity: amount("Eigen vermogen at the end of the financial year"),
  cash: amount("Liquide middelen at the end of the financial year"),
  netResult: amount("Resultaat na belastingen of the financial year. Negative for a loss"),
  pensionObligation: amount(
    "Balance-sheet provision for pension in own management or the oudedagsverplichting (pensioenvoorziening / ODV) at year end",
  ),
  directorCurrentAccount: amount(
    "Rekening-courant with the director-shareholder at year end. Positive when the BV has a claim on the DGA, negative when the BV owes the DGA",
  ),
  dividendPaid: amount("Dividend paid out or declared during the financial year"),
  directorSalary: amount("Gross salary of the director-shareholder (bezoldiging bestuurder), only when stated"),
  // Totals as printed, so our own code can check the figures above.
  balanceTotalAssets: amount("Balance-sheet total on the assets side (totaal activa) at year end, same balance sheet as above"),
  balanceTotalLiabilities: amount("Balance-sheet total on the liabilities side (totaal passiva) at year end, same balance sheet as above"),
  resultBeforeTax: amount("Resultaat voor belastingen of the financial year. Negative for a loss"),
  taxOnResult: amount("Vennootschapsbelasting on the result. Positive for a tax charge, negative for a tax benefit"),
  notes: z
    .array(z.string())
    .describe("Short remarks in Dutch for the financial planner: consolidated vs. company-only figures, ambiguous values, etc."),
});

export type JaarrekeningExtraction = z.infer<typeof jaarrekeningSchema>;
