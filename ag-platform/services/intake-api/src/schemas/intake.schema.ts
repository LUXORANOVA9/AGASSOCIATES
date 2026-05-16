import { z } from 'zod';

export const bankNames = ['ICICI', 'Kotak', 'Axis', 'Muthoot', 'HDFC'] as const;

export const intakePayloadSchema = z.object({
  email_path: z
    .string()
    .regex(
      /^(https?|s3|gs):\/\/.+/,
      { message: 'email_path must be a valid URL (http(s)://, s3://, or gs://)' },
    ),
  bank_name: z.enum(bankNames, {
    errorMap: () => ({ message: `bank_name must be one of: ${bankNames.join(', ')}` }),
  }),
  sender_email: z.string().email().optional(),
  received_timestamp: z.string().datetime().optional(),
});

export type IntakePayload = z.infer<typeof intakePayloadSchema>;
