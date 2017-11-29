'use strict';

var node = require('../../../../node');
var shared = require('../../../shared');
var accountFixtures = require('../../../../fixtures/accounts');

var apiCodes = require('../../../../../helpers/apiCodes');

var sendTransactionPromise = require('../../../../common/apiHelpers').sendTransactionPromise;
var waitForConfirmations = require('../../../../common/apiHelpers').waitForConfirmations;

var sendTransactionPromise = require('../../../../common/apiHelpers').sendTransactionPromise;
var sendSignaturePromise = require('../../../../common/apiHelpers').sendSignaturePromise;

var randomUtil = require('../../../../common/utils/random');

function beforeValidationPhase (scenarios) {
	var transactionsToWaitFor = [];

	before(function () {
		return node.Promise.all(Object.keys(scenarios).map(function (type) {
			if (type === 'no_funds') {
				return;
			}
			var transaction = node.lisk.transaction.createTransaction(scenarios[type].account.address, scenarios[type].amount, accountFixtures.genesis.password);
			transactionsToWaitFor.push(transaction.id);

			return sendTransactionPromise(transaction).then(function (res) {
				node.expect(res).to.have.property('status').to.equal(200);
				node.expect(res).to.have.nested.property('body.status').to.equal('Transaction(s) accepted');
			});
		}))
			.then(function () {
				return waitForConfirmations(transactionsToWaitFor);
			})
			.then(function () {
				return node.Promise.all(Object.keys(scenarios).map(function (type) {
					var transaction = node.lisk.multisignature.createMultisignature(scenarios[type].account.password, null, scenarios[type].keysgroup, scenarios[type].lifetime, scenarios[type].min);
					scenarios[type].transaction = transaction;
					transactionsToWaitFor.push(transaction.id);

					return sendTransactionPromise(transaction).then(function (res) {
						node.expect(res).to.have.property('status').to.equal(200);
						node.expect(res).to.have.nested.property('body.status').to.equal('Transaction(s) accepted');
					});
				}));
			})
			.then(function () {
				return node.Promise.all(Object.keys(scenarios).map(function (type) {
					return node.Promise.all(node.Promise.map(scenarios[type].members, function (member) {
						var signature = node.lisk.multisignature.signTransaction(scenarios[type].transaction, member.password);

						return sendSignaturePromise(signature, scenarios[type].transaction).then(function (res) {
							node.expect(res).to.have.property('statusCode').to.equal(apiCodes.OK);
							node.expect(res).to.have.nested.property('body.status').to.equal('Signature Accepted');
						});
					}));
				}));
			})
			.then(function () {
				return waitForConfirmations(transactionsToWaitFor);
			});
	});
};

function sendAndSignMultisigTransaction (type, scenario) {
	var transaction;

	switch (type) {
		case 'transfer':
			transaction = node.lisk.transaction.createTransaction(randomUtil.account().address, 1, scenario.account.password);
			break;
		case 'signature':
			transaction = node.lisk.signature.createSignature(scenario.account.password, scenario.account.secondPassword);
			break;
		case 'delegate':
			transaction = node.lisk.delegate.createDelegate(scenario.account.password, scenario.account.username);
			break;
		case 'votes':
			transaction = node.lisk.vote.createVote(scenario.account.password, ['+' + accountFixtures.existingDelegate.publicKey]);
			break;
		case 'dapp':
			transaction = node.lisk.dapp.createDapp(scenario.account.password, null, randomUtil.guestbookDapp);
			randomUtil.guestbookDapp.id = transaction.id;
			break;
		case 'inTransfer':
			transaction = node.lisk.transfer.createInTransfer(randomUtil.guestbookDapp.id, 1, scenario.account.password);
			break;
		case 'outTransfer':
			transaction = node.lisk.transfer.createOutTransfer(randomUtil.guestbookDapp.id, randomUtil.transaction().id, randomUtil.account().address, 1, scenario.account.password);
			break;
	};

	return sendTransactionPromise(transaction)
		.then(function (res) {
			node.expect(res).to.have.property('status').to.equal(200);
			node.expect(res).to.have.nested.property('body.status').to.equal('Transaction(s) accepted');
		})
		.then(function () {
			return node.Promise.all(node.Promise.map(scenario.members, function (member) {
				var signature = node.lisk.multisignature.signTransaction(transaction, member.password);

				return sendSignaturePromise(signature, transaction).then(function (res) {
					node.expect(res).to.have.property('statusCode').to.equal(apiCodes.OK);
					node.expect(res).to.have.nested.property('body.status').to.equal('Signature Accepted');
				});
			}));
		})
		.then(function () {
			return transaction;
		});
}

module.exports = {
	beforeValidationPhase: beforeValidationPhase,
	sendAndSignMultisigTransaction: sendAndSignMultisigTransaction
};
