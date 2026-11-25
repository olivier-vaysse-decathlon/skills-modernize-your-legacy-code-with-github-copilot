"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const applicationPath = path.join(__dirname, "..", "index.js");
const { createAccount, formatBalance, parseAmount } = require("../index");

function runApplication(input) {
  const result = spawnSync(process.execPath, [applicationPath], {
    encoding: "utf8",
    input,
  });

  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test("ACCT-001 initializes and displays a new account balance", () => {
  const account = createAccount();
  assert.equal(account.getBalance(), 100_000);

  const output = runApplication("1\n4\n");
  assert.match(output, /Current balance: 001000\.00/);
});

test("ACCT-002 viewing the balance does not change it", () => {
  const output = runApplication("1\n1\n4\n");
  assert.equal((output.match(/Current balance: 001000\.00/g) ?? []).length, 2);
});

test("ACCT-003 credits a positive decimal amount and retains cents", () => {
  const account = createAccount();
  assert.equal(account.credit(parseAmount("25.75")), true);
  assert.equal(formatBalance(account.getBalance()), "001025.75");

  const output = runApplication("2\n25.75\n1\n4\n");
  assert.match(output, /Amount credited\. New balance: 001025\.75/);
  assert.match(output, /Current balance: 001025\.75/);
});

test("ACCT-004 debits an amount less than the current balance", () => {
  const account = createAccount();
  assert.equal(account.debit(parseAmount("250.25")), true);
  assert.equal(formatBalance(account.getBalance()), "000749.75");

  const output = runApplication("3\n250.25\n1\n4\n");
  assert.match(output, /Amount debited\. New balance: 000749\.75/);
  assert.match(output, /Current balance: 000749\.75/);
});

test("ACCT-005 allows a debit equal to the full balance", () => {
  const account = createAccount();
  assert.equal(account.debit(parseAmount("1000.00")), true);
  assert.equal(account.getBalance(), 0);

  const output = runApplication("3\n1000.00\n1\n4\n");
  assert.match(output, /Amount debited\. New balance: 000000\.00/);
  assert.match(output, /Current balance: 000000\.00/);
});

test("ACCT-006 rejects a debit greater than the balance without changing it", () => {
  const account = createAccount();
  assert.equal(account.debit(parseAmount("1000.01")), false);
  assert.equal(account.getBalance(), 100_000);

  const output = runApplication("3\n1000.01\n1\n4\n");
  assert.match(output, /Insufficient funds for this debit\./);
  assert.match(output, /Current balance: 001000\.00/);
});

test("ACCT-007 retains updates across operations in one run", () => {
  const account = createAccount();
  assert.equal(account.credit(parseAmount("10.00")), true);
  assert.equal(account.debit(parseAmount("3.00")), true);
  assert.equal(formatBalance(account.getBalance()), "001007.00");

  const output = runApplication("2\n10.00\n3\n3.00\n1\n4\n");
  assert.match(output, /Current balance: 001007\.00/);
});

test("ACCT-008 accepts a zero-value credit without changing the balance", () => {
  const account = createAccount();
  assert.equal(account.credit(parseAmount("0.00")), true);
  assert.equal(account.getBalance(), 100_000);

  const output = runApplication("2\n0.00\n1\n4\n");
  assert.match(output, /Amount credited\. New balance: 001000\.00/);
  assert.match(output, /Current balance: 001000\.00/);
});

test("ACCT-009 accepts a zero-value debit without changing the balance", () => {
  const account = createAccount();
  assert.equal(account.debit(parseAmount("0.00")), true);
  assert.equal(account.getBalance(), 100_000);

  const output = runApplication("3\n0.00\n1\n4\n");
  assert.match(output, /Amount debited\. New balance: 001000\.00/);
  assert.match(output, /Current balance: 001000\.00/);
});

test("ACCT-010 treats a negative credit input as its positive magnitude", () => {
  assert.equal(parseAmount("-25.00"), 2_500);

  const output = runApplication("2\n-25.00\n1\n4\n");
  assert.match(output, /Amount credited\. New balance: 001025\.00/);
  assert.match(output, /Current balance: 001025\.00/);
});

test("ACCT-011 treats a negative debit input as its positive magnitude", () => {
  assert.equal(parseAmount("-25.00"), 2_500);

  const output = runApplication("3\n-25.00\n1\n4\n");
  assert.match(output, /Amount debited\. New balance: 000975\.00/);
  assert.match(output, /Current balance: 000975\.00/);
});

test("ACCT-012 rejects out-of-range menu choices and shows the menu again", () => {
  const output = runApplication("0\n5\n1\n4\n");
  assert.equal(
    (output.match(/Invalid choice, please select 1-4\./g) ?? []).length,
    2,
  );
  assert.match(output, /Current balance: 001000\.00/);
});

test("ACCT-013 exits cleanly on menu choice 4", () => {
  const output = runApplication("4\n");
  assert.match(output, /Exiting the program\. Goodbye!/);
  assert.equal((output.match(/Account Management System/g) ?? []).length, 1);
});

test("ACCT-014 resets the balance when the process restarts", () => {
  const firstRun = runApplication("2\n10.00\n4\n");
  const secondRun = runApplication("1\n4\n");

  assert.match(firstRun, /New balance: 001010\.00/);
  assert.match(secondRun, /Current balance: 001000\.00/);
});

test("ACCT-015 enforces the maximum balance without corrupting it", () => {
  const account = createAccount();
  assert.equal(account.credit(parseAmount("998999.99")), true);
  assert.equal(account.getBalance(), 99_999_999);
  assert.equal(account.credit(parseAmount("0.01")), false);
  assert.equal(account.getBalance(), 99_999_999);

  const output = runApplication("2\n998999.99\n2\n0.01\n1\n4\n");
  assert.match(output, /Amount credited\. New balance: 999999\.99/);
  assert.match(output, /Credit would exceed the maximum balance/);
  assert.match(output, /Current balance: 999999\.99/);
});

test("ACCT-016 handles invalid menu and amount input without changing data", () => {
  assert.equal(parseAmount("not-a-number"), null);
  assert.equal(parseAmount("1.001"), null);

  const output = runApplication("not-a-choice\n2\nnot-an-amount\n25.00\n1\n4\n");
  assert.match(output, /Invalid choice, please select 1-4\./);
  assert.match(output, /Invalid amount\./);
  assert.match(output, /Amount credited\. New balance: 001025\.00/);
  assert.match(output, /Current balance: 001025\.00/);
});
