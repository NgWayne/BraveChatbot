let chai = require('chai');
let SessionState = require('../SessionState.js');
const STATES = require('../SessionStateEnum.js');
let imports = require('../server.js')
let server = imports.server
let registry = imports.registry
let sessions = imports.sessions
let fs = require('fs');
let chaiHttp = require('chai-http');
chai.use(chaiHttp);
const expect = chai.expect;
require('dotenv').load();
let Datastore = require('nedb-promise')

describe('Chatbot server', () => {

	let defaultRequest = {
		'UUID': '111',
		'Type': 'click'
	};

	let defaultRequestDouble = {
		'UUID': '111',
		'Type': 'double_click'
	};

	let defaultRequestHold = {
		'UUID': '111',
		'Type': 'hold'
	};

	let defaultRequest2 = {
		'UUID': '222',
		'Type': 'click'
	};

	let defaultBody = {
		'UUID': '111',
		'Unit': '123',
		'PhoneNumber': '+16664206969',
		'Type': 'click'
	};

	let defaultBody2 = {
		'UUID': '222',
		'Unit': '222',
		'PhoneNumber': '+17774106868',
		'Type': 'click'
	};

	let twilioMessageBody = {
		'From': process.env.RESPONDER_PHONE_TEST,
		'Body': 'Please answer "Ok" to this message when you have responded to the alert.',
		'To': '+16664206969'
	};

	describe('POST request: button press', () => {

		beforeEach(async function() {
            await sessions.remove({}, {multi: true})
            await registry.insert([{"uuid":"111","unit":"123","phone":"+16664206969","_id":"CGBadbmt3EhfDeYd"},
                                   {"uuid":"222","unit":"222","phone":"+17774106868","_id":"JUdabgmtlwp0pgjW"}])
		});

		afterEach(async function() {
            await sessions.remove({}, {multi: true})
            await registry.remove({}, {multi: true})
            sessions.nedb.persistence.compactDatafile()
            registry.nedb.persistence.compactDatafile()
	    });

		it('should return 400 to a request with an empty body', async () => {
			let response = await chai.request(server).post('/').send({});
			expect(response).to.have.status(400);
		});

		it('should return 400 to a request with an unregistered button', async () => {
			let response = await chai.request(server).post('/').send({'UUID': '666','Type': 'click'});
			expect(response).to.have.status(400);
		});

		it('should return ok to a valid request', async () => {
			let response = await chai.request(server).post('/').send(defaultRequest);
			expect(response).to.have.status(200);
		});

		it('should update the session state for a valid request', async () => {
			
			let response = await chai.request(server).post('/').send(defaultRequest);

			let session = await sessions.findOne({'phoneNumber':defaultBody.PhoneNumber})
            expect(session).to.not.be.null
            let currentState = new SessionState(session.uuid, session.unit, session.phoneNumber, session.state, session.numPresses);
            
            expect(currentState).to.not.be.null;
            expect(currentState).to.have.property('uuid');
            expect(currentState).to.have.property('unit');
            expect(currentState).to.have.property('completed');
            expect(currentState).to.have.property('state');
            expect(currentState).to.have.property('numPresses');
            expect(currentState.uuid).to.deep.equal(defaultBody.UUID);
            expect(currentState.unit).to.deep.equal(defaultBody.Unit);
            expect(currentState.completed).to.be.false;
            expect(currentState.numPresses).to.deep.equal(2);
            log(currentState.numPresses.toString())
		});

		it('should ignore requests from different uuid if session not completed', async () => {

			let response = await chai.request(server).post('/').send(defaultRequest);
			response = await chai.request(server).post('/').send(defaultRequest2);

			let session = await sessions.findOne({'phoneNumber':defaultBody.PhoneNumber})
            let currentState = new SessionState(session.uuid, session.unit, session.phoneNumber, session.state, session.numPresses);
            
            expect(currentState).to.not.be.null;
            expect(currentState).to.have.property('uuid');
            expect(currentState).to.have.property('unit');
            expect(currentState).to.have.property('completed');
            expect(currentState).to.have.property('numPresses');
            expect(currentState.uuid).to.deep.equal(defaultBody.UUID);
            expect(currentState.unit).to.deep.equal(defaultBody.Unit);
            expect(currentState.completed).to.be.false;
            expect(currentState.numPresses).to.deep.equal(3);
		});

		it('should increment button presses when requests from same uuid if session not completed', async () => {

			let response = await chai.request(server).post('/').send(defaultRequest);
		    response = await chai.request(server).post('/').send(defaultRequestDouble);
			response = await chai.request(server).post('/').send(defaultRequestHold);

			let session = await sessions.findOne({'phoneNumber':defaultBody.PhoneNumber})
            let currentState = new SessionState(session.uuid, session.unit, session.phoneNumber, session.state, session.numPresses);

            expect(currentState).to.not.be.null;
            expect(currentState).to.have.property('uuid');
            expect(currentState).to.have.property('unit');
            expect(currentState).to.have.property('completed');
            expect(currentState).to.have.property('state');
            expect(currentState).to.have.property('numPresses');
            expect(currentState.uuid).to.deep.equal(defaultBody.UUID);
            expect(currentState.unit).to.deep.equal(defaultBody.Unit);
            expect(currentState.completed).to.be.false;
            expect(currentState.numPresses).to.deep.equal(7);
		});
	});

	describe('POST request: twilio message', () => {

		beforeEach(async function() {
            await sessions.remove({}, {multi: true})
            await registry.insert([{"uuid":"111","unit":"123","phone":"+16664206969","_id":"CGBadbmt3EhfDeYd"},
                                   {"uuid":"222","unit":"222","phone":"+17774106868","_id":"JUdabgmtlwp0pgjW"}])
		});

		afterEach(async function() {
            await sessions.remove({}, {multi: true})
            await registry.remove({}, {multi: true})
            sessions.nedb.persistence.compactDatafile()
            registry.nedb.persistence.compactDatafile()
	    });

		it('should return ok to a valid request', async () => {
			let response = await chai.request(server).post('/message').send(twilioMessageBody);
			expect(response).to.have.status(200);
		});

		it('should return 400 to a request with an incomplete body', async () => {
			let response = await chai.request(server).post('/message').send({'Body': 'hi'});
			expect(response).to.have.status(400);
		});

		it('should return 400 to a request from an invalid phone number', async () => {
			let response = await chai.request(server).post('/message').send({'Body': 'hi', 'From': '+16664206969'});
			expect(response).to.have.status(400);
		});

		it('should return ok to a valid request and advance session appropriately', async () => {

		    let response = await chai.request(server).post('/').send(defaultBody);

			let session = await sessions.findOne({'phoneNumber':defaultBody.PhoneNumber})
            let currentState = new SessionState(session.uuid, session.unit, session.phoneNumber, session.state, session.numPresses);
            expect(currentState.state).to.deep.equal(STATES.STARTED);

			response = await chai.request(server).post('/message').send(twilioMessageBody);
			expect(response).to.have.status(200);

            session = sessions.findOne({'phoneNumber':defaultBody.PhoneNumber})
            currentState = new SessionState(session.uuid, session.unit, session.phoneNumber, session.state, session.numPresses);
            expect(currentState.state).to.deep.equal(STATES.WAITING_FOR_CATEGORY);
		});

		it('should be able to advance a session to completion and accept new requests', async () => {

			let response = await chai.request(server).post('/').send(defaultBody);
			let session = await sessions.findOne({'phoneNumber': defaultBody.PhoneNumber})
            let currentState = new SessionState(session.uuid, session.unit, session.phoneNumber, session.state, session.numPresses);
            expect(currentState.state).to.deep.equal(STATES.STARTED);

			response = await chai.request(server).post('/message').send(twilioMessageBody); // => category
			response = await chai.request(server).post('/message').send({'From': process.env.RESPONDER_PHONE_TEST, 'Body': '0', 'To': defaultBody.PhoneNumber}); // => details
			response = await chai.request(server).post('/message').send(twilioMessageBody);  // complete

			expect(response).to.have.status(200);

			session = await sessions.findOne({'phoneNumber':defaultBody.PhoneNumber})

            currentState = new SessionState(session.uuid, session.unit, session.phoneNumber, session.state, session.numPresses);
            expect(currentState.state).to.deep.equal(STATES.COMPLETED);
            expect(currentState.completed).to.be.true;

			// now send a different request
			response = await chai.request(server).post('/').send(defaultBody2);

    	    session = sessions.findOne({'phoneNumber':defaultBody2.PhoneNumber})
            currentState = new SessionState(sessions.uuid, session.unit, session.phoneNumber, session.state, session.numPresses);
            expect(currentState.uuid).to.deep.equal(defaultBody2.UUID);
            expect(currentState.unit).to.deep.equal(defaultBody2.Unit);
            expect(currentState.completed).to.be.false;
            expect(currentState.numPresses).to.deep.equal(1);
		});
	});
});
