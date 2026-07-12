const {
  createAccountingApp,
  createDataProgram,
  MAX_CENTS,
} = require('./index');

async function runMainWithInputs(inputs, initialBalanceCents = 100000) {
  const output = [];
  const prompts = [];
  let pointer = 0;

  const app = createAccountingApp({
    initialBalanceCents,
    writeLine: (line) => output.push(line),
    readLine: async (prompt) => {
      prompts.push(prompt);
      if (pointer >= inputs.length) {
        return null;
      }

      const value = inputs[pointer];
      pointer += 1;
      return String(value);
    },
  });

  await app.runMainLoop();

  return {
    output,
    prompts,
    app,
  };
}

describe('COBOL test plan parity', () => {
  test('TC-001 displays main menu on startup', async () => {
    const { output, prompts } = await runMainWithInputs(['4']);

    expect(output).toContain('Account Management System');
    expect(output).toContain('1. View Balance');
    expect(output).toContain('2. Credit Account');
    expect(output).toContain('3. Debit Account');
    expect(output).toContain('4. Exit');
    expect(prompts).toContain('Enter your choice (1-4): ');
  });

  test('TC-002 view balance shows initial default value', async () => {
    const { output } = await runMainWithInputs(['1', '4']);

    expect(output).toContain('Current balance: 1000.00');
  });

  test('TC-003 credit account with valid integer amount', async () => {
    const { output } = await runMainWithInputs(['2', '200', '1', '4']);

    expect(output).toContain('Amount credited. New balance: 1200.00');
    expect(output).toContain('Current balance: 1200.00');
  });

  test('TC-004 credit account with decimal amount', async () => {
    const { output } = await runMainWithInputs(['2', '25.50', '1', '4']);

    expect(output).toContain('Amount credited. New balance: 1025.50');
    expect(output).toContain('Current balance: 1025.50');
  });

  test('TC-005 debit account with sufficient funds', async () => {
    const { output } = await runMainWithInputs(['3', '300', '1', '4']);

    expect(output).toContain('Amount debited. New balance: 700.00');
    expect(output).toContain('Current balance: 700.00');
  });

  test('TC-006 debit equal to full balance is allowed', async () => {
    const { output } = await runMainWithInputs(['3', '1000', '1', '4']);

    expect(output).toContain('Amount debited. New balance: 0.00');
    expect(output).toContain('Current balance: 0.00');
  });

  test('TC-007 reject debit when amount exceeds available balance', async () => {
    const { output } = await runMainWithInputs(['3', '1000.01', '1', '4']);

    expect(output).toContain('Insufficient funds for this debit.');
    expect(output).toContain('Current balance: 1000.00');
  });

  test('TC-008 cumulative balance across multiple operations', async () => {
    const { output } = await runMainWithInputs(['2', '100', '3', '40', '1', '4']);

    expect(output).toContain('Current balance: 1060.00');
  });

  test('TC-009 invalid menu choice handling', async () => {
    const { output } = await runMainWithInputs(['9', '4']);

    expect(output).toContain('Invalid choice, please select 1-4.');
  });

  test('TC-010 exit flow terminates loop', async () => {
    const { output } = await runMainWithInputs(['4']);

    expect(output).toContain('Exiting the program. Goodbye!');
  });

  test('TC-011 data read reflects latest stored balance after write', async () => {
    const { output } = await runMainWithInputs(['2', '75', '1', '3', '25', '1', '4']);

    expect(output).toContain('Current balance: 1075.00');
    expect(output).toContain('Current balance: 1050.00');
  });

  test('TC-012 data write stores latest computed value', async () => {
    const { output, app } = await runMainWithInputs(['2', '50', '3', '20', '1', '4']);

    expect(output).toContain('Current balance: 1030.00');
    expect(app.dataProgram.getBalanceCents()).toBe(103000);
  });

  test('TC-013 unsupported operation code in operations is a no-op', async () => {
    const output = [];
    const app = createAccountingApp({
      writeLine: (line) => output.push(line),
      readLine: async () => null,
    });

    await app.operationsProgram('OTHER ');

    expect(output).toEqual([]);
    expect(app.dataProgram.getBalanceCents()).toBe(100000);
  });

  test('TC-014 unsupported operation code in data layer is a no-op', () => {
    const dataProgram = createDataProgram();

    dataProgram.run('NOTOP', 12345);

    expect(dataProgram.run('READ')).toBe(100000);
  });

  test('TC-015 amount upper bound behavior is enforced', async () => {
    const output = [];
    let inputPointer = 0;
    const app = createAccountingApp({
      initialBalanceCents: MAX_CENTS - 1,
      writeLine: (line) => output.push(line),
      readLine: async () => {
        const values = ['0.01', '0.01', '1000000'];
        if (inputPointer >= values.length) {
          return null;
        }

        const value = values[inputPointer];
        inputPointer += 1;
        return value;
      },
    });

    await app.operationsProgram('CREDIT');
    await app.operationsProgram('CREDIT');
    await app.operationsProgram('CREDIT');

    expect(output).toContain('Amount credited. New balance: 999999.99');
    expect(output).toContain('Amount exceeds maximum allowed balance of 999999.99.');
    expect(output).toContain('Invalid amount. Please enter a positive number with up to 2 decimals.');
    expect(app.dataProgram.getBalanceCents()).toBe(MAX_CENTS);
  });

  test('TC-016 non-numeric amount input is rejected', async () => {
    const output = [];
    let inputPointer = 0;
    const app = createAccountingApp({
      writeLine: (line) => output.push(line),
      readLine: async () => {
        const values = ['ABC', 'XYZ'];
        if (inputPointer >= values.length) {
          return null;
        }

        const value = values[inputPointer];
        inputPointer += 1;
        return value;
      },
    });

    await app.operationsProgram('CREDIT');
    await app.operationsProgram('DEBIT ');

    expect(output).toEqual([
      'Invalid amount. Please enter a positive number with up to 2 decimals.',
      'Invalid amount. Please enter a positive number with up to 2 decimals.',
    ]);
    expect(app.dataProgram.getBalanceCents()).toBe(100000);
  });
});
