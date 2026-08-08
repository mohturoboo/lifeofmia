import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { created, ok } from '@/lib/api/response';
import { transactionSchema } from '@/lib/validation/modules';
import { dateKeyIn, startOfMonthKey } from '@/lib/date';

/**
 * GET /api/transactions?month=YYYY-MM
 * Renvoie les operations du mois, le solde et la repartition par categorie.
 */
export const GET = route(async ({ user, searchParams }) => {
  const today = dateKeyIn(user.timezone);
  const month = searchParams.get('month') ?? today.slice(0, 7);
  const from = `${month}-01`;
  const to = `${month}-31`;

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id, date: { gte: from, lte: to } },
    orderBy: { date: 'desc' },
  });

  const income = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expense = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const byCategory = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce<Record<string, number>>((accumulator, transaction) => {
      accumulator[transaction.category] = (accumulator[transaction.category] ?? 0) + transaction.amount;
      return accumulator;
    }, {});

  return ok({
    month,
    transactions,
    summary: {
      income: Math.round(income * 100) / 100,
      expense: Math.round(expense * 100) / 100,
      balance: Math.round((income - expense) * 100) / 100,
    },
    byCategory,
    currentMonth: startOfMonthKey(today).slice(0, 7),
  });
});

export const POST = route(
  async ({ user, body }) => {
    const transaction = await prisma.transaction.create({ data: { userId: user.id, ...body } });
    return created(transaction);
  },
  { schema: transactionSchema },
);
