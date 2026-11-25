"use strict";

const readline = require("node:readline");
const { stdin, stdout } = require("node:process");

const INITIAL_BALANCE_CENTS = 100_000;
const MAX_AMOUNT_CENTS = 99_999_999;
const MAX_BALANCE_CENTS = 99_999_999;

function parseAmount(input) {
  // Match the unsigned COBOL field: discard a leading sign.
  const unsignedInput = input.trim().replace(/^[+-]/, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(unsignedInput);
  if (!match) {
    return null;
  }

  const wholeUnits = Number(match[1]);
  const fractionalCents = Number((match[2] ?? "").padEnd(2, "0"));
  const amountCents = wholeUnits * 100 + fractionalCents;

  if (!Number.isSafeInteger(amountCents) || amountCents > MAX_AMOUNT_CENTS) {
    return null;
  }

  return amountCents;
}

function formatBalance(amountCents) {
  const wholeUnits = Math.floor(amountCents / 100)
    .toString()
    .padStart(6, "0");
  const fractionalCents = (amountCents % 100).toString().padStart(2, "0");
  return `${wholeUnits}.${fractionalCents}`;
}

function assertValidAmount(amountCents) {
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents < 0 ||
    amountCents > MAX_AMOUNT_CENTS
  ) {
    throw new RangeError("Amount must be between 0.00 and 999999.99.");
  }
}

function createAccount(initialBalanceCents = INITIAL_BALANCE_CENTS) {
  if (
    !Number.isSafeInteger(initialBalanceCents) ||
    initialBalanceCents < 0 ||
    initialBalanceCents > MAX_BALANCE_CENTS
  ) {
    throw new RangeError("Initial balance must be between 0.00 and 999999.99.");
  }

  let balanceCents = initialBalanceCents;

  return {
    getBalance() {
      return balanceCents;
    },
    credit(amountCents) {
      assertValidAmount(amountCents);
      if (balanceCents + amountCents > MAX_BALANCE_CENTS) {
        return false;
      }

      balanceCents += amountCents;
      return true;
    },
    debit(amountCents) {
      assertValidAmount(amountCents);
      if (balanceCents < amountCents) {
        return false;
      }

      balanceCents -= amountCents;
      return true;
    },
  };
}

function displayMenu(output) {
  output.write(
    [
      "--------------------------------",
      "Account Management System",
      "1. View Balance",
      "2. Credit Account",
      "3. Debit Account",
      "4. Exit",
      "--------------------------------",
    ].join("\n") + "\n",
  );
}

async function promptForAmount(ask, output, prompt) {
  while (true) {
    const enteredAmount = await ask(prompt);
    const amountCents = parseAmount(enteredAmount);
    if (amountCents !== null) {
      return amountCents;
    }

    output.write(
      "Invalid amount. Enter a number with up to two decimal places, not exceeding 999999.99.\n",
    );
  }
}

async function runApp({ input = stdin, output = stdout } = {}) {
  const interface_ = readline.createInterface({ input, output });
  const lines = interface_[Symbol.asyncIterator]();
  const account = createAccount();

  try {
    async function ask(prompt) {
      output.write(prompt);
      const { value, done } = await lines.next();
      if (done) {
        throw new Error("Input ended before the application exited.");
      }

      return value;
    }

    let continueRunning = true;
    while (continueRunning) {
      displayMenu(output);
      const choice = (await ask("Enter your choice (1-4): ")).trim();

      switch (choice) {
        case "1":
          output.write(`Current balance: ${formatBalance(account.getBalance())}\n`);
          break;
        case "2": {
          const amountCents = await promptForAmount(
            ask,
            output,
            "Enter credit amount: ",
          );
          if (account.credit(amountCents)) {
            output.write(
              `Amount credited. New balance: ${formatBalance(account.getBalance())}\n`,
            );
          } else {
            output.write(
              "Credit would exceed the maximum balance. The balance is unchanged.\n",
            );
          }
          break;
        }
        case "3": {
          const amountCents = await promptForAmount(
            ask,
            output,
            "Enter debit amount: ",
          );
          if (account.debit(amountCents)) {
            output.write(
              `Amount debited. New balance: ${formatBalance(account.getBalance())}\n`,
            );
          } else {
            output.write("Insufficient funds for this debit.\n");
          }
          break;
        }
        case "4":
          continueRunning = false;
          break;
        default:
          output.write("Invalid choice, please select 1-4.\n");
      }
    }

    output.write("Exiting the program. Goodbye!\n");
  } finally {
    interface_.close();
  }

  return account;
}

if (require.main === module) {
  runApp().catch((error) => {
    console.error("Failed to run the accounting application:", error);
    process.exitCode = 1;
  });
}

module.exports = { createAccount, formatBalance, parseAmount, runApp };
