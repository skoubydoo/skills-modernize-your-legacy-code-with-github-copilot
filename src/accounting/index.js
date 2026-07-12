const readline = require('node:readline');

const SCALE = 100;
const MAX_CENTS = 99999999;

const DEFAULT_BALANCE_CENTS = 100000;

function formatMoney(cents) {
  return (cents / SCALE).toFixed(2);
}

function parseAmountToCents(input) {
  const trimmed = String(input).trim();

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  const [wholePart, decimalPart = ''] = trimmed.split('.');
  const normalizedDecimal = decimalPart.padEnd(2, '0');
  const cents = Number(wholePart) * SCALE + Number(normalizedDecimal);

  if (!Number.isInteger(cents) || cents < 0 || cents > MAX_CENTS) {
    return null;
  }

  return cents;
}

async function question(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

function createDataProgram(initialBalanceCents = DEFAULT_BALANCE_CENTS) {
  let storageBalanceCents = initialBalanceCents;

  function run(operation, balanceCents) {
    if (operation === 'READ') {
      return storageBalanceCents;
    }

    if (operation === 'WRITE') {
      storageBalanceCents = balanceCents;
      return storageBalanceCents;
    }

    return storageBalanceCents;
  }

  return {
    run,
    getBalanceCents() {
      return storageBalanceCents;
    },
  };
}

function createAccountingApp({
  readLine,
  writeLine = console.log,
  initialBalanceCents = DEFAULT_BALANCE_CENTS,
} = {}) {
  const dataProgram = createDataProgram(initialBalanceCents);

  async function operationsProgram(operationType) {
    if (operationType === 'TOTAL ') {
      const finalBalanceCents = dataProgram.run('READ');
      writeLine(`Current balance: ${formatMoney(finalBalanceCents)}`);
      return;
    }

    if (operationType === 'CREDIT') {
      const amountInput = await readLine('Enter credit amount: ');

      if (amountInput === null) {
        return;
      }

      const amountCents = parseAmountToCents(amountInput);

      if (amountCents === null) {
        writeLine('Invalid amount. Please enter a positive number with up to 2 decimals.');
        return;
      }

      const finalBalanceCents = dataProgram.run('READ') + amountCents;

      if (finalBalanceCents > MAX_CENTS) {
        writeLine('Amount exceeds maximum allowed balance of 999999.99.');
        return;
      }

      dataProgram.run('WRITE', finalBalanceCents);
      writeLine(`Amount credited. New balance: ${formatMoney(finalBalanceCents)}`);
      return;
    }

    if (operationType === 'DEBIT ') {
      const amountInput = await readLine('Enter debit amount: ');

      if (amountInput === null) {
        return;
      }

      const amountCents = parseAmountToCents(amountInput);

      if (amountCents === null) {
        writeLine('Invalid amount. Please enter a positive number with up to 2 decimals.');
        return;
      }

      const finalBalanceCents = dataProgram.run('READ');

      if (finalBalanceCents >= amountCents) {
        const updatedBalanceCents = finalBalanceCents - amountCents;
        dataProgram.run('WRITE', updatedBalanceCents);
        writeLine(`Amount debited. New balance: ${formatMoney(updatedBalanceCents)}`);
      } else {
        writeLine('Insufficient funds for this debit.');
      }
    }
  }

  async function runMainLoop() {
    let continueFlag = 'YES';

    while (continueFlag !== 'NO') {
      writeLine('--------------------------------');
      writeLine('Account Management System');
      writeLine('1. View Balance');
      writeLine('2. Credit Account');
      writeLine('3. Debit Account');
      writeLine('4. Exit');
      writeLine('--------------------------------');

      const choiceInput = await readLine('Enter your choice (1-4): ');

      if (choiceInput === null) {
        continueFlag = 'NO';
        break;
      }

      const userChoice = Number.parseInt(choiceInput, 10);

      if (userChoice === 1) {
        await operationsProgram('TOTAL ');
      } else if (userChoice === 2) {
        await operationsProgram('CREDIT');
      } else if (userChoice === 3) {
        await operationsProgram('DEBIT ');
      } else if (userChoice === 4) {
        continueFlag = 'NO';
      } else {
        writeLine('Invalid choice, please select 1-4.');
      }
    }

    writeLine('Exiting the program. Goodbye!');
  }

  return {
    operationsProgram,
    runMainLoop,
    dataProgram,
  };
}

async function mainProgram() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let inputClosed = false;
  rl.on('close', () => {
    inputClosed = true;
  });

  const app = createAccountingApp({
    readLine: async (prompt) => {
      if (inputClosed) {
        return null;
      }

      const answer = await question(rl, prompt);

      if (inputClosed) {
        return null;
      }

      return answer;
    },
    writeLine: (line) => {
      console.log(line);
    },
  });

  await app.runMainLoop();
  rl.close();
}

if (require.main === module) {
  mainProgram().catch((error) => {
    console.error('Unexpected error:', error);
    process.exitCode = 1;
  });
}

module.exports = {
  createAccountingApp,
  createDataProgram,
  formatMoney,
  parseAmountToCents,
  SCALE,
  MAX_CENTS,
};
