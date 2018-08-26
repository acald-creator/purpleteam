require('app-module-path').addPath(process.cwd());
exports.lab = require('lab').script();

const { describe, it, before, beforeEach, afterEach } = exports.lab;

const { expect, fail } = require('code');
const sinon = require('sinon');
const rewire = require('rewire');
const readFileAsync = require('util').promisify(require('fs').readFile);
const config = require('config/config');
const log = require('purpleteam-logger').init(config.get('logger'));

const apiUrl = config.get('purpleteamApi.url');
const eventSourceOrigin = `${config.get('purpleteamApi.protocol')}://${config.get('purpleteamApi.ip')}:${config.get('purpleteamApi.port')}`;
const buildUserConfigFilePath = config.get('buildUserConfig.fileUri');
const dashboard = require('src/view/dashboard');
const api = require('src/presenter/apiDecoratingAdapter');
const { MockEvent, EventSource } = require('./mocksse');
const { TesterProgressRouteSuffix } = require('src/strings');
const Model = require('src/models/model');


describe('apiDecoratingAdapter', () => {
  before(async (flags) => {
    flags.context.buildUserConfigFileContent = await (async () => readFileAsync(buildUserConfigFilePath, { encoding: 'utf8' }))();
  });
  describe('getTestPlans', () => {
    it('- should provide the dashboard with the test plan to display', async (flags) => {
      const { context: { buildUserConfigFileContent } } = flags;
      const rewiredApi = rewire('src/presenter/apiDecoratingAdapter');
      const configFileContents = await buildUserConfigFileContent;
      rewiredApi.init(log);
      const apiResponse = [{
        name: 'app',
        message: `@app_scan
        Feature: Web application free of security vulnerabilities known to Zap
        
        # Before hooks are run befroe Background
        
        Background:
          Given a new test session based on each build user supplied testSession
          And each build user supplied route of each testSession is navigated
          And a new scanning session based on each build user supplied testSession
          And the application is spidered for each testSession
          And all active scanners are disabled
        
        Scenario: The application should not contain vulnerabilities known to Zap that exceed the build user defined threshold
          Given all active scanners are enabled 
          When the active scan is run
          Then the vulnerability count should not exceed the build user defined threshold of vulnerabilities known to Zap
        
          
        
        @simple_math
        Feature: Simple maths
          In order to do maths
          As a developer
          I want to increment variables
        
          Scenario: easy maths
            Given a variable set to 1
            When I increment the variable by 1
            Then the variable should contain 2
        
          Scenario Outline: much more complex stuff
            Given a variable set to <var>
            When I increment the variable by <increment>
            Then the variable should contain <result>
        
            Examples:
              | var | increment | result |
              | 100 |         5 |    105 |
              |  99 |      1234 |   1333 |
              |  12 |         5 |     17 |`
      }, {
        name: 'server',
        message: 'No test plan available for the server tester. The server tester is currently in-active.'
      }, {
        name: 'tls',
        message: 'No test plan available for the tls tester. The tls tester is currently in-active.'
      }];

      const expectedArgPasssedToTestPlan = [{
        name: 'app',
        message: `@app_scan
        Feature: Web application free of security vulnerabilities known to Zap
        
        # Before hooks are run befroe Background
        
        Background:
          Given a new test session based on each build user supplied testSession
          And each build user supplied route of each testSession is navigated
          And a new scanning session based on each build user supplied testSession
          And the application is spidered for each testSession
          And all active scanners are disabled
        
        Scenario: The application should not contain vulnerabilities known to Zap that exceed the build user defined threshold
          Given all active scanners are enabled 
          When the active scan is run
          Then the vulnerability count should not exceed the build user defined threshold of vulnerabilities known to Zap
        
          
        
        @simple_math
        Feature: Simple maths
          In order to do maths
          As a developer
          I want to increment variables
        
          Scenario: easy maths
            Given a variable set to 1
            When I increment the variable by 1
            Then the variable should contain 2
        
          Scenario Outline: much more complex stuff
            Given a variable set to <var>
            When I increment the variable by <increment>
            Then the variable should contain <result>
        
            Examples:
              | var | increment | result |
              | 100 |         5 |    105 |
              |  99 |      1234 |   1333 |
              |  12 |         5 |     17 |`
      }, {
        name: 'server',
        message: 'No test plan available for the server tester. The server tester is currently in-active.'
      }, {
        name: 'tls',
        message: 'No test plan available for the tls tester. The tls tester is currently in-active.'
      }];

      const rewiredRequest = rewiredApi.__get__('request');
      const requestStub = sinon.stub(rewiredRequest, 'post');
      requestStub.returns(Promise.resolve(apiResponse));
      const revertRewiredApiRequest = rewiredApi.__set__('request', requestStub);

      const testPlanStub = sinon.stub(dashboard, 'testPlan');
      dashboard.testPlan = testPlanStub;
      const revertRewiredApiDashboard = rewiredApi.__set__('dashboard', dashboard);

      flags.onCleanup = () => {
        rewiredRequest.post.restore();
        dashboard.testPlan.restore();
        revertRewiredApiRequest();
        revertRewiredApiDashboard();
      };

      await rewiredApi.getTestPlans(configFileContents);

      expect(testPlanStub.getCall(0).args[0]).to.equal(expectedArgPasssedToTestPlan);
    });
  });


  describe('postToApi', () => {
    const request = {
      uri: `${apiUrl}/testplan`,
      method: 'POST',
      json: true,
      body: '{\n  "data": {\n    "type": "testRun",\n    "attributes": {      \n      "version": "0.1.0-alpha.1",\n      "sutAuthentication": {\n        "route": "/login",\n        "usernameFieldLocater": "userName",\n        "passwordFieldLocater": "password",\n        "submit": "btn btn-danger"\n      },\n      "sutIp": "172.17.0.1",\n      "sutPort": "4000",\n      "sutProtocol": "http",\n      "browser": "chrome",\n      "loggedInIndicator": "<p>Moved Temporarily. Redirecting to <a href=\\"\\/dashboard\\">\\/dashboard<\\/a><\\/p>",\n      "reportFormats": ["html", "json", "md"]\n    },\n    "relationships": {\n      "data": [{\n        "type": "testSession",\n        "id": "lowPrivUser"\n      },\n      {\n        "type": "testSession",\n        "id": "adminUser"\n      }]\n    }\n  },\n  "included": [\n    {\n      "type": "testSession",\n      "id": "lowPrivUser",\n      "attributes": {\n        "username": "user1",\n        "password": "User1_123",\n        "aScannerAttackStrength": "HIGH",\n        "aScannerAlertThreshold": "LOW",\n        "alertThreshold": 12\n      },\n      "relationships": {\n        "data": [{\n          "type": "route",\n          "id": "/profile"\n        }]\n      }\n    },\n    {\n      "type": "testSession",\n      "id": "adminUser",\n      "attributes": {\n        "username": "admin",\n        "password": "Admin_123"\n      },\n      "relationships": {\n        "data": [{\n          "type": "route",\n          "id": "/memos"\n        },\n        {\n          "type": "route",\n          "id": "/profile"\n        }]\n      }\n    },\n    {\n      "type": "route",\n      "id": "/profile",\n      "attributes": {\n        "attackFields": [\n          {"name": "firstName", "value": "PurpleJohn", "visible": true},\n          {"name": "lastName", "value": "PurpleDoe", "visible": true},\n          {"name": "ssn", "value": "PurpleSSN", "visible": true},\n          {"name": "dob", "value": "12/23/5678", "visible": true},\n          {"name": "bankAcc", "value": "PurpleBankAcc", "visible": true},\n          {"name": "bankRouting", "value": "0198212#", "visible": true},\n          {"name": "address", "value": "PurpleAddress", "visible": true},\n          {"name": "_csrf", "value": ""},\n          {"name": "submit", "value": ""}\n        ],\n        "method": "POST",\n        "submit": "submit"\n      }\n    },\n    {\n      "type": "route",\n      "id": "/memos",\n      "attributes": {\n        "attackFields": [\n          {"name": "memo", "value": "PurpleMemo", "visible": true}\n        ],\n        "submit": "btn btn-primary"\n      }\n    }\n  ]\n}\n',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        Accept: 'text/plain'
      }
    };
    const requestMissingTypeOfTestSession = {
      uri: `${apiUrl}/testplan`,
      method: 'POST',
      json: true,
      body: '{\n  "data": {\n    "type": "testRun",\n    "attributes": {      \n      "version": "0.1.0-alpha.1",\n      "sutAuthentication": {\n        "route": "/login",\n        "usernameFieldLocater": "userName",\n        "passwordFieldLocater": "password",\n        "submit": "btn btn-danger"\n      },\n      "sutIp": "172.17.0.1",\n      "sutPort": "4000",\n      "sutProtocol": "http",\n      "browser": "chrome",\n      "loggedInIndicator": "<p>Moved Temporarily. Redirecting to <a href=\\"\\/dashboard\\">\\/dashboard<\\/a><\\/p>",\n      "reportFormats": ["html", "json", "md"]\n    },\n    "relationships": {\n      "data": [{\n        "type": "testSession",\n        "id": "lowPrivUser"\n      },\n      {\n        "type": "testSession",\n        "id": "adminUser"\n      }]\n    }\n  },\n  "included": [\n    {\n      "id": "lowPrivUser",\n      "attributes": {\n        "username": "user1",\n        "password": "User1_123",\n        "aScannerAttackStrength": "HIGH",\n        "aScannerAlertThreshold": "LOW",\n        "alertThreshold": 12\n      },\n      "relationships": {\n        "data": [{\n          "type": "route",\n          "id": "/profile"\n        }]\n      }\n    },\n    {\n      "type": "testSession",\n      "id": "adminUser",\n      "attributes": {\n        "username": "admin",\n        "password": "Admin_123"\n      },\n      "relationships": {\n        "data": [{\n          "type": "route",\n          "id": "/memos"\n        },\n        {\n          "type": "route",\n          "id": "/profile"\n        }]\n      }\n    },\n    {\n      "type": "route",\n      "id": "/profile",\n      "attributes": {\n        "attackFields": [\n          {"name": "firstName", "value": "PurpleJohn", "visible": true},\n          {"name": "lastName", "value": "PurpleDoe", "visible": true},\n          {"name": "ssn", "value": "PurpleSSN", "visible": true},\n          {"name": "dob", "value": "12/23/5678", "visible": true},\n          {"name": "bankAcc", "value": "PurpleBankAcc", "visible": true},\n          {"name": "bankRouting", "value": "0198212#", "visible": true},\n          {"name": "address", "value": "PurpleAddress", "visible": true},\n          {"name": "_csrf", "value": ""},\n          {"name": "submit", "value": ""}\n        ],\n        "method": "POST",\n        "submit": "submit"\n      }\n    },\n    {\n      "type": "route",\n      "id": "/memos",\n      "attributes": {\n        "attackFields": [\n          {"name": "memo", "value": "PurpleMemo", "visible": true}\n        ],\n        "submit": "btn btn-primary"\n      }\n    }\n  ]\n}\n',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        Accept: 'text/plain'
      }
    };
    const requestMissingComma = {
      uri: `${apiUrl}/testplan`,
      method: 'POST',
      json: true,
      body: '{\n  "data": {\n    "type": "testRun",\n    "attributes": {      \n      "version": "0.1.0-alpha.1",\n      "sutAuthentication": {\n        "route": "/login",\n        "usernameFieldLocater": "userName",\n        "passwordFieldLocater": "password",\n        "submit": "btn btn-danger"\n      },\n      "sutIp": "172.17.0.1",\n      "sutPort": "4000",\n      "sutProtocol": "http",\n      "browser": "chrome",\n      "loggedInIndicator": "<p>Moved Temporarily. Redirecting to <a href=\\"\\/dashboard\\">\\/dashboard<\\/a><\\/p>",\n      "reportFormats": ["html", "json", "md"]\n    },\n    "relationships": {\n      "data": [{\n        "type": "testSession",\n        "id": "lowPrivUser"\n      },\n      {\n        "type": "testSession",\n        "id": "adminUser"\n      }]\n    }\n  },\n  "included": [\n    {\n      "type": "testSession"\n      "id": "lowPrivUser",\n      "attributes": {\n        "username": "user1",\n        "password": "User1_123",\n        "aScannerAttackStrength": "HIGH",\n        "aScannerAlertThreshold": "LOW",\n        "alertThreshold": 12\n      },\n      "relationships": {\n        "data": [{\n          "type": "route",\n          "id": "/profile"\n        }]\n      }\n    },\n    {\n      "type": "testSession",\n      "id": "adminUser",\n      "attributes": {\n        "username": "admin",\n        "password": "Admin_123"\n      },\n      "relationships": {\n        "data": [{\n          "type": "route",\n          "id": "/memos"\n        },\n        {\n          "type": "route",\n          "id": "/profile"\n        }]\n      }\n    },\n    {\n      "type": "route",\n      "id": "/profile",\n      "attributes": {\n        "attackFields": [\n          {"name": "firstName", "value": "PurpleJohn", "visible": true},\n          {"name": "lastName", "value": "PurpleDoe", "visible": true},\n          {"name": "ssn", "value": "PurpleSSN", "visible": true},\n          {"name": "dob", "value": "12/23/5678", "visible": true},\n          {"name": "bankAcc", "value": "PurpleBankAcc", "visible": true},\n          {"name": "bankRouting", "value": "0198212#", "visible": true},\n          {"name": "address", "value": "PurpleAddress", "visible": true},\n          {"name": "_csrf", "value": ""},\n          {"name": "submit", "value": ""}\n        ],\n        "method": "POST",\n        "submit": "submit"\n      }\n    },\n    {\n      "type": "route",\n      "id": "/memos",\n      "attributes": {\n        "attackFields": [\n          {"name": "memo", "value": "PurpleMemo", "visible": true}\n        ],\n        "submit": "btn btn-primary"\n      }\n    }\n  ]\n}\n',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        Accept: 'text/plain'
      }
    };


    beforeEach(async (flags) => {
      const { context } = flags;
      context.rewiredApi = rewire('src/presenter/apiDecoratingAdapter');

      context.rewiredRequest = context.rewiredApi.__get__('request');
      context.requestStub = sinon.stub(context.rewiredRequest, 'post');

      context.revertRewiredApiRequest = context.rewiredApi.__set__('request', context.requestStub);

      context.log = log;
      context.critStub = sinon.stub(context.log, 'crit');
      context.log.crit = context.critStub;
      context.rewiredApi.init(context.log);
    });


    // it('- on - socket hang up - should throw error - backendTookToLong', () => {
    //   // Todo: KC: Need to reproduce error state.
    // });


    it('- on - connect ECONNREFUSED - should throw error - backendUnreachable', async (flags) => {
      const { context: { buildUserConfigFileContent, rewiredApi, requestStub, critStub } } = flags;
      const configFileContents = await buildUserConfigFileContent;
      const error = {
        name: 'RequestError',
        message: 'Error: connect ECONNREFUSED 127.0.0.1:2000',
        cause: {
          code: 'ECONNREFUSED',
          errno: 'ECONNREFUSED',
          syscall: 'connect',
          address: '127.0.0.1',
          port: 2000
        },
        error: {
          code: 'ECONNREFUSED',
          errno: 'ECONNREFUSED',
          syscall: 'connect',
          address: '127.0.0.1',
          port: 2000
        },
        options: {
          uri: 'http://127.0.0.1:2000/testplan',
          method: 'POST',
          json: true,
          body: '{\n  "data": {\n    "type": "testRun",\n    "attributes": {      \n      "version": "0.1.0-alpha.1",\n      "sutAuthentication": {\n        "route": "/login",\n        "usernameFieldLocater": "userName",\n        "passwordFieldLocater": "password",\n        "submit": "btn btn-danger"\n      },\n      "sutIp": "172.17.0.1",\n      "sutPort": "4000",\n      "sutProtocol": "http",\n      "browser": "chrome",\n      "loggedInIndicator": "<p>Moved Temporarily. Redirecting to <a href=\\"\\/dashboard\\">\\/dashboard<\\/a><\\/p>",\n      "reportFormats": ["html", "json", "md"]\n    },\n    "relationships": {\n      "data": [{\n        "type": "testSession",\n        "id": "lowPrivUser"\n      },\n      {\n        "type": "testSession",\n        "id": "adminUser"\n      }]\n    }\n  },\n  "included": [\n    {\n      "type": "testSession",\n      "id": "lowPrivUser",\n      "attributes": {\n        "username": "user1",\n        "password": "User1_123",\n        "aScannerAttackStrength": "HIGH",\n        "aScannerAlertThreshold": "LOW",\n        "alertThreshold": 12\n      },\n      "relationships": {\n        "data": [{\n          "type": "route",\n          "id": "/profile"\n        }]\n      }\n    },\n    {\n      "type": "testSession",\n      "id": "adminUser",\n      "attributes": {\n        "username": "admin",\n        "password": "Admin_123"\n      },\n      "relationships": {\n        "data": [{\n          "type": "route",\n          "id": "/memos"\n        },\n        {\n          "type": "route",\n          "id": "/profile"\n        }]\n      }\n    },\n    {\n      "type": "route",\n      "id": "/profile",\n      "attributes": {\n        "attackFields": [\n          {"name": "firstName", "value": "PurpleJohn", "visible": true},\n          {"name": "lastName", "value": "PurpleDoe", "visible": true},\n          {"name": "ssn", "value": "PurpleSSN", "visible": true},\n          {"name": "dob", "value": "12/23/5678", "visible": true},\n          {"name": "bankAcc", "value": "PurpleBankAcc", "visible": true},\n          {"name": "bankRouting", "value": "0198212#", "visible": true},\n          {"name": "address", "value": "PurpleAddress", "visible": true},\n          {"name": "_csrf", "value": ""},\n          {"name": "submit", "value": ""}\n        ],\n        "method": "POST",\n        "submit": "submit"\n      }\n    },\n    {\n      "type": "route",\n      "id": "/memos",\n      "attributes": {\n        "attackFields": [\n          {"name": "memo", "value": "PurpleMemo", "visible": true}\n        ],\n        "submit": "btn btn-primary"\n      }\n    }\n  ]\n}\n',
          headers: {
            'Content-Type': 'application/vnd.api+json',
            Accept: 'text/plain'
          },
          simple: true,
          resolveWithFullResponse: false,
          transform2xxOnly: false
        }
      };
      requestStub.returns(Promise.reject(error));

      await rewiredApi.getTestPlans(configFileContents);

      expect(requestStub.getCall(0).args[0]).to.equal(request);
      expect(critStub.getCall(0).args[0]).to.equal('Error occured while attempting to communicate with the purpleteam SaaS. Error was: "The purpleteam backend is currently unreachable".');
      expect(critStub.getCall(0).args[1]).to.equal({ tags: ['apiDecoratingAdapter'] });
      expect(critStub.getCall(1)).to.equal(null);
    });


    it('- on - ValidationError - should throw error - validationError', async (flags) => {
      // Lots of checking around the validation on the server side will be required.
      const { context: { rewiredApi, requestStub, critStub } } = flags;
      const configFileContents = await (async () => readFileAsync(`${process.cwd()}/testResources/jobs/job_0.1.0-alpha.1_missing_type_of_testSession`, { encoding: 'utf8' }))();
      const error = {
        name: 'StatusCodeError',
        statusCode: 400,
        message: '400 - {"statusCode":400,"error":"Bad Request","message":"child \\"included\\" fails because [\\"included\\" must contain 3 items]","name":"ValidationError"}',
        error: {
          statusCode: 400,
          error: 'Bad Request',
          message: 'child "included" fails because ["included" must contain 3 items]',
          name: 'ValidationError'
        },
        options: {
          uri: 'http://127.0.0.1:2000/testplan',
          method: 'POST',
          json: true,
          body: '{\n  "data": {\n    "type": "testRun",\n    "attributes": {      \n      "version": "0.1.0-alpha.1",\n      "sutAuthentication": {\n        "route": "/login",\n        "usernameFieldLocater": "userName",\n        "passwordFieldLocater": "password",\n        "submit": "btn btn-danger"\n      },\n      "sutIp": "172.17.0.1",\n      "sutPort": "4000",\n      "sutProtocol": "http",\n      "browser": "chrome",\n      "loggedInIndicator": "<p>Moved Temporarily. Redirecting to <a href=\\"\\/dashboard\\">\\/dashboard<\\/a><\\/p>",\n      "reportFormats": ["html", "json", "md"]\n    },\n    "relationships": {\n      "data": [{\n        "type": "testSession",\n        "id": "lowPrivUser"\n      },\n      {\n        "type": "testSession",\n        "id": "adminUser"\n      }]\n    }\n  },\n  "included": [\n    {      \n      "id": "lowPrivUser",\n      "attributes": {\n        "username": "user1",\n        "password": "User1_123",\n        "aScannerAttackStrength": "HIGH",\n        "aScannerAlertThreshold": "LOW",\n        "alertThreshold": 12\n      },\n      "relationships": {\n        "data": [{\n          "type": "route",\n          "id": "/profile"\n        }]\n      }\n    },\n    {\n      "type": "testSession",\n      "id": "adminUser",\n      "attributes": {\n        "username": "admin",\n        "password": "Admin_123"\n      },\n      "relationships": {\n        "data": [{\n          "type": "route",\n          "id": "/memos"\n        },\n        {\n          "type": "route",\n          "id": "/profile"\n        }]\n      }\n    },\n    {\n      "type": "route",\n      "id": "/profile",\n      "attributes": {\n        "attackFields": [\n          {"name": "firstName", "value": "PurpleJohn", "visible": true},\n          {"name": "lastName", "value": "PurpleDoe", "visible": true},\n          {"name": "ssn", "value": "PurpleSSN", "visible": true},\n          {"name": "dob", "value": "12/23/5678", "visible": true},\n          {"name": "bankAcc", "value": "PurpleBankAcc", "visible": true},\n          {"name": "bankRouting", "value": "0198212#", "visible": true},\n          {"name": "address", "value": "PurpleAddress", "visible": true},\n          {"name": "_csrf", "value": ""},\n          {"name": "submit", "value": ""}\n        ],\n        "method": "POST",\n        "submit": "submit"\n      }\n    },\n    {\n      "type": "route",\n      "id": "/memos",\n      "attributes": {\n        "attackFields": [\n          {"name": "memo", "value": "PurpleMemo", "visible": true}\n        ],\n        "submit": "btn btn-primary"\n      }\n    }\n  ]\n}\n',
          headers: {
            'Content-Type': 'application/vnd.api+json',
            Accept: 'text/plain'
          },
          simple: true,
          resolveWithFullResponse: false,
          transform2xxOnly: false
        },
        response: {
          statusCode: 400,
          body: {
            statusCode: 400,
            error: 'Bad Request',
            message: 'child "included" fails because ["included" must contain 3 items]',
            name: 'ValidationError'
          },
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-cache',
            'content-length': '146',
            date: 'Wed, 15 Aug 2018 02:05:34 GMT',
            connection: 'close'
          },
          request: {
            uri: {
              protocol: 'http:',
              slashes: true,
              auth: null,
              host: '127.0.0.1:2000',
              port: '2000',
              hostname: '127.0.0.1',
              hash: null,
              search: null,
              query: null,
              pathname: '/testplan',
              path: '/testplan',
              href: 'http://127.0.0.1:2000/testplan'
            },
            method: 'POST',
            headers: {
              'Content-Type': 'application/vnd.api+json',
              Accept: 'text/plain',
              'content-length': 2873
            }
          }
        }
      };
      requestStub.returns(Promise.reject(error));

      await rewiredApi.getTestPlans(configFileContents);

      expect(requestStub.getCall(0).args[0]).to.equal(requestMissingTypeOfTestSession);
      expect(critStub.getCall(0).args[0]).to.equal('Error occured while attempting to communicate with the purpleteam SaaS. Error was: Validation of the supplied build user config failed: child "included" fails because ["included" must contain 3 items].');
      expect(critStub.getCall(0).args[1]).to.equal({ tags: ['apiDecoratingAdapter'] });
      expect(critStub.getCall(1)).to.equal(null);
    });


    it('- on - SyntaxError - should throw error - syntaxError', async (flags) => {
      const { context: { rewiredApi, requestStub, critStub } } = flags;
      const configFileContents = await (async () => readFileAsync(`${process.cwd()}/testResources/jobs/job_0.1.0-alpha.1_missing_comma`, { encoding: 'utf8' }))();
      const error = {
        name: 'StatusCodeError',
        statusCode: 400,
        message: '400 - {"statusCode":400,"error":"Bad Request","message":"Unexpected string in JSON at position 810","name":"SyntaxError"}',
        error: {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Unexpected string in JSON at position 810',
          name: 'SyntaxError'
        },
        options: {
          uri: 'http://127.0.0.1:2000/testplan',
          method: 'POST',
          json: true,
          body: '{\n  "data": {\n    "type": "testRun",\n    "attributes": {      \n      "version": "0.1.0-alpha.1",\n      "sutAuthentication": {\n        "route": "/login",\n        "usernameFieldLocater": "userName",\n        "passwordFieldLocater": "password",\n        "submit": "btn btn-danger"\n      },\n      "sutIp": "172.17.0.1",\n      "sutPort": "4000",\n      "sutProtocol": "http",\n      "browser": "chrome",\n      "loggedInIndicator": "<p>Moved Temporarily. Redirecting to <a href=\\"\\/dashboard\\">\\/dashboard<\\/a><\\/p>",\n      "reportFormats": ["html", "json", "md"]\n    },\n    "relationships": {\n      "data": [{\n        "type": "testSession",\n        "id": "lowPrivUser"\n      },\n      {\n        "type": "testSession",\n        "id": "adminUser"\n      }]\n    }\n  },\n  "included": [\n    {\n      "type": "testSession"\n      "id": "lowPrivUser",\n      "attributes": {\n        "username": "user1",\n        "password": "User1_123",\n        "aScannerAttackStrength": "HIGH",\n        "aScannerAlertThreshold": "LOW",\n        "alertThreshold": 12\n      },\n      "relationships": {\n        "data": [{\n          "type": "route",\n          "id": "/profile"\n        }]\n      }\n    },\n    {\n      "type": "testSession",\n      "id": "adminUser",\n      "attributes": {\n        "username": "admin",\n        "password": "Admin_123"\n      },\n      "relationships": {\n        "data": [{\n          "type": "route",\n          "id": "/memos"\n        },\n        {\n          "type": "route",\n          "id": "/profile"\n        }]\n      }\n    },\n    {\n      "type": "route",\n      "id": "/profile",\n      "attributes": {\n        "attackFields": [\n          {"name": "firstName", "value": "PurpleJohn", "visible": true},\n          {"name": "lastName", "value": "PurpleDoe", "visible": true},\n          {"name": "ssn", "value": "PurpleSSN", "visible": true},\n          {"name": "dob", "value": "12/23/5678", "visible": true},\n          {"name": "bankAcc", "value": "PurpleBankAcc", "visible": true},\n          {"name": "bankRouting", "value": "0198212#", "visible": true},\n          {"name": "address", "value": "PurpleAddress", "visible": true},\n          {"name": "_csrf", "value": ""},\n          {"name": "submit", "value": ""}\n        ],\n        "method": "POST",\n        "submit": "submit"\n      }\n    },\n    {\n      "type": "route",\n      "id": "/memos",\n      "attributes": {\n        "attackFields": [\n          {"name": "memo", "value": "PurpleMemo", "visible": true}\n        ],\n        "submit": "btn btn-primary"\n      }\n    }\n  ]\n}\n',
          headers: {
            'Content-Type': 'application/vnd.api+json',
            Accept: 'text/plain'
          },
          simple: true,
          resolveWithFullResponse: false,
          transform2xxOnly: false
        },
        response: {
          statusCode: 400,
          body: {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Unexpected string in JSON at position 810',
            name: 'SyntaxError'
          },
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-cache',
            'content-length': '115',
            date: 'Wed, 15 Aug 2018 06:39:11 GMT',
            connection: 'close'
          },
          request: {
            uri: {
              protocol: 'http:',
              slashes: true,
              auth: null,
              host: '127.0.0.1:2000',
              port: '2000',
              hostname: '127.0.0.1',
              hash: null,
              search: null,
              query: null,
              pathname: '/testplan',
              path: '/testplan',
              href: 'http://127.0.0.1:2000/testplan'
            },
            method: 'POST',
            headers: {
              'Content-Type': 'application/vnd.api+json',
              Accept: 'text/plain',
              'content-length': 2900
            }
          }
        }
      };
      requestStub.returns(Promise.reject(error));

      await rewiredApi.getTestPlans(configFileContents);

      expect(requestStub.getCall(0).args[0]).to.equal(requestMissingComma);
      expect(critStub.getCall(0).args[0]).to.equal('Error occured while attempting to communicate with the purpleteam SaaS. Error was: SyntaxError: Unexpected string in JSON at position 810.');
      expect(critStub.getCall(0).args[1]).to.equal({ tags: ['apiDecoratingAdapter'] });
      expect(critStub.getCall(1)).to.equal(null);
    });


    it('- on - 500 - should throw error - unknown', async (flags) => {
      const { context: { buildUserConfigFileContent, rewiredApi, requestStub, critStub } } = flags;
      const configFileContents = await buildUserConfigFileContent;
      const statusCodeError = {
        name: 'StatusCodeError',
        statusCode: 500,
        message: '500 - {"statusCode":500,"error":"Internal Server Error","message":"An internal server error occurred"}',
        error: {
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An internal server error occurred'
        },
        options: {
          uri: 'http://127.0.0.1:2000/testplan',
          method: 'POST',
          json: true,
          body: '{\n  "data": {\n    "type": "testRun",\n    "attributes": {      \n      "version": "0.1.0-alpha.1",\n      "sutAuthentication": {\n        "route": "/login",\n        "usernameFieldLocater": "userName",\n        "passwordFieldLocater": "password",\n        "submit": "btn btn-danger"\n      },\n      "sutIp": "172.17.0.1",\n      "sutPort": "4000",\n      "sutProtocol": "http",\n      "browser": "chrome",\n      "loggedInIndicator": "<p>Moved Temporarily. Redirecting to <a href=\\"\\/dashboard\\">\\/dashboard<\\/a><\\/p>",\n      "reportFormats": ["html", "json", "md"]\n    },\n    "relationships": {\n      "data": [{\n        "type": "testSession",\n        "id": "lowPrivUser"\n      },\n      {\n        "type": "testSession",\n        "id": "adminUser"\n      }]\n    }\n  },\n  "included": [\n    {\n      "type": "testSession",\n      "id": "lowPrivUser",\n      "attributes": {\n        "username": "user1",\n        "password": "User1_123",\n        "aScannerAttackStrength": "HIGH",\n        "aScannerAlertThreshold": "LOW",\n        "alertThreshold": 12\n      },\n      "relationships": {\n        "data": [{\n          "type": "route",\n          "id": "/profile"\n        }]\n      }\n    },\n    {\n      "type": "testSession",\n      "id": "adminUser",\n      "attributes": {\n        "username": "admin",\n        "password": "Admin_123"\n      },\n      "relationships": {\n        "data": [{\n          "type": "route",\n          "id": "/memos"\n        },\n        {\n          "type": "route",\n          "id": "/profile"\n        }]\n      }\n    },\n    {\n      "type": "route",\n      "id": "/profile",\n      "attributes": {\n        "attackFields": [\n          {"name": "firstName", "value": "PurpleJohn", "visible": true},\n          {"name": "lastName", "value": "PurpleDoe", "visible": true},\n          {"name": "ssn", "value": "PurpleSSN", "visible": true},\n          {"name": "dob", "value": "12/23/5678", "visible": true},\n          {"name": "bankAcc", "value": "PurpleBankAcc", "visible": true},\n          {"name": "bankRouting", "value": "0198212#", "visible": true},\n          {"name": "address", "value": "PurpleAddress", "visible": true},\n          {"name": "_csrf", "value": ""},\n          {"name": "submit", "value": ""}\n        ],\n        "method": "POST",\n        "submit": "submit"\n      }\n    },\n    {\n      "type": "route",\n      "id": "/memos",\n      "attributes": {\n        "attackFields": [\n          {"name": "memo", "value": "PurpleMemo", "visible": true}\n        ],\n        "submit": "btn btn-primary"\n      }\n    }\n  ]\n}\n',
          headers: {
            'Content-Type': 'application/vnd.api+json',
            Accept: 'text/plain'
          },
          simple: true,
          resolveWithFullResponse: false,
          transform2xxOnly: false
        },
        response: {
          statusCode: 500,
          body: {
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'An internal server error occurred'
          },
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-cache',
            'content-length': '96',
            date: 'Wed, 15 Aug 2018 01:15:04 GMT',
            connection: 'close'
          },
          request: {
            uri: {
              protocol: 'http:',
              slashes: true,
              auth: null,
              host: '127.0.0.1:2000',
              port: '2000',
              hostname: '127.0.0.1',
              hash: null,
              search: null,
              query: null,
              pathname: '/testplan',
              path: '/testplan',
              href: 'http://127.0.0.1:2000/testplan'
            },
            method: 'POST',
            headers: {
              'Content-Type': 'application/vnd.api+json',
              Accept: 'text/plain',
              'content-length': 2901
            }
          }
        }
      };
      requestStub.returns(Promise.reject(statusCodeError));

      await rewiredApi.getTestPlans(configFileContents);

      expect(requestStub.getCall(0).args[0]).to.equal(request);
      expect(critStub.getCall(0).args[0]).to.equal('Error occured while attempting to communicate with the purpleteam SaaS. Error was: "Unknown"');
      expect(critStub.getCall(0).args[1]).to.equal({ tags: ['apiDecoratingAdapter'] });
      expect(critStub.getCall(1)).to.equal(null);
    });


    afterEach((flags) => {
      const { context } = flags;
      context.revertRewiredApiRequest();

      context.log.crit.restore();
      context.rewiredRequest.post.restore();
    });
  });


  describe('test and subscribeToTesterProgress', async () => {
    beforeEach(async (flags) => {
      const { context } = flags;
      context.request = {
        uri: `${apiUrl}/test`,
        method: 'POST',
        json: true,
        body: '{\n  "data": {\n    "type": "testRun",\n    "attributes": {      \n      "version": "0.1.0-alpha.1",\n      "sutAuthentication": {\n        "route": "/login",\n        "usernameFieldLocater": "userName",\n        "passwordFieldLocater": "password",\n        "submit": "btn btn-danger"\n      },\n      "sutIp": "172.17.0.1",\n      "sutPort": "4000",\n      "sutProtocol": "http",\n      "browser": "chrome",\n      "loggedInIndicator": "<p>Moved Temporarily. Redirecting to <a href=\\"\\/dashboard\\">\\/dashboard<\\/a><\\/p>",\n      "reportFormats": ["html", "json", "md"]\n    },\n    "relationships": {\n      "data": [{\n        "type": "testSession",\n        "id": "lowPrivUser"\n      },\n      {\n        "type": "testSession",\n        "id": "adminUser"\n      }]\n    }\n  },\n  "included": [\n    {\n      "type": "testSession",\n      "id": "lowPrivUser",\n      "attributes": {\n        "username": "user1",\n        "password": "User1_123",\n        "aScannerAttackStrength": "HIGH",\n        "aScannerAlertThreshold": "LOW",\n        "alertThreshold": 12\n      },\n      "relationships": {\n        "data": [{\n          "type": "route",\n          "id": "/profile"\n        }]\n      }\n    },\n    {\n      "type": "testSession",\n      "id": "adminUser",\n      "attributes": {\n        "username": "admin",\n        "password": "Admin_123"\n      },\n      "relationships": {\n        "data": [{\n          "type": "route",\n          "id": "/memos"\n        },\n        {\n          "type": "route",\n          "id": "/profile"\n        }]\n      }\n    },\n    {\n      "type": "route",\n      "id": "/profile",\n      "attributes": {\n        "attackFields": [\n          {"name": "firstName", "value": "PurpleJohn", "visible": true},\n          {"name": "lastName", "value": "PurpleDoe", "visible": true},\n          {"name": "ssn", "value": "PurpleSSN", "visible": true},\n          {"name": "dob", "value": "12/23/5678", "visible": true},\n          {"name": "bankAcc", "value": "PurpleBankAcc", "visible": true},\n          {"name": "bankRouting", "value": "0198212#", "visible": true},\n          {"name": "address", "value": "PurpleAddress", "visible": true},\n          {"name": "_csrf", "value": ""},\n          {"name": "submit", "value": ""}\n        ],\n        "method": "POST",\n        "submit": "submit"\n      }\n    },\n    {\n      "type": "route",\n      "id": "/memos",\n      "attributes": {\n        "attackFields": [\n          {"name": "memo", "value": "PurpleMemo", "visible": true}\n        ],\n        "submit": "btn btn-primary"\n      }\n    }\n  ]\n}\n',
        headers: {
          'Content-Type': 'application/vnd.api+json',
          Accept: 'text/plain'
        }
      };
      context.rewiredApi = rewire('src/presenter/apiDecoratingAdapter');
      context.configFileContents = await context.buildUserConfigFileContent;

      context.rewiredApi.init(log);

      context.rewiredRequest = context.rewiredApi.__get__('request');
      context.requestStub = sinon.stub(context.rewiredRequest, 'post');
    });


    it('- should subscribe to models tester events - should propagate initial tester responses from each tester to model - then verify event flow back through presenter and then to view', async (flags) => {
      const { context: { configFileContents, rewiredApi, request, rewiredRequest, requestStub } } = flags;
      const apiResponse = [
        {
          name: 'app',
          message: 'App tests are now running.'
        },
        {
          name: 'server',
          message: 'No server testing available currently. The server tester is currently in-active.'
        },
        {
          name: 'tls',
          message: 'No tls testing available currently. The tls tester is currently in-active.'
        }
      ];

      requestStub.returns(Promise.resolve(apiResponse));
      const revertRewiredApiRequest = rewiredApi.__set__('request', requestStub);

      const testStub = sinon.stub(dashboard, 'test');
      dashboard.test = testStub;

      const rewiredHandleModelTesterEvents = rewiredApi.__get__('handleModelTesterEvents');
      const handleModelTesterEventsSpy = sinon.spy(rewiredHandleModelTesterEvents);
      const revertRewiredApiHandleModelTesterEvents = rewiredApi.__set__('handleModelTesterEvents', handleModelTesterEventsSpy);

      const handleTesterProgressStub = sinon.stub(dashboard, 'handleTesterProgress');
      dashboard.handleTesterProgress = handleTesterProgressStub;

      const revertRewiredApiDashboard = rewiredApi.__set__('dashboard', dashboard);
      const revertRewiredApiApiUrl = rewiredApi.__set__('apiUrl', `${apiUrl}`);

      flags.onCleanup = () => {
        rewiredRequest.post.restore();
        dashboard.test.restore();
        dashboard.handleTesterProgress.restore();
        revertRewiredApiRequest();
        revertRewiredApiHandleModelTesterEvents();
        revertRewiredApiDashboard();
        revertRewiredApiApiUrl();
      };

      await rewiredApi.test(configFileContents);

      expect(requestStub.getCall(0).args[0]).to.equal(request);
      expect(requestStub.callCount).to.equal(1);

      const expectedTesterSessions = [ // Taken from the model test
        { testerType: 'app', sessionId: 'lowPrivUser', threshold: 12 },
        { testerType: 'app', sessionId: 'adminUser', threshold: 0 },
        { testerType: 'server', sessionId: 'NA', threshold: 0 },
        { testerType: 'tls', sessionId: 'NA', threshold: 0 }
      ];

      expect(testStub.getCall(0).args[0]).to.equal(expectedTesterSessions);
      expect(testStub.callCount).to.equal(1);

      expect(handleModelTesterEventsSpy.callCount).to.equal(4);
      expect(handleTesterProgressStub.callCount).to.equal(4);

      expect(handleModelTesterEventsSpy.getCall(0).args).to.equal(['testerProgress', 'app', 'lowPrivUser', 'App tests are now running.']);
      expect(handleTesterProgressStub.getCall(0).args).to.equal(['app', 'lowPrivUser', 'App tests are now running.']);

      expect(handleModelTesterEventsSpy.getCall(1).args).to.equal(['testerProgress', 'app', 'adminUser', 'App tests are now running.']);
      expect(handleTesterProgressStub.getCall(1).args).to.equal(['app', 'adminUser', 'App tests are now running.']);

      expect(handleModelTesterEventsSpy.getCall(2).args).to.equal(['testerProgress', 'server', 'NA', 'No server testing available currently. The server tester is currently in-active.']);
      expect(handleTesterProgressStub.getCall(2).args).to.equal(['server', 'NA', 'No server testing available currently. The server tester is currently in-active.']);

      expect(handleModelTesterEventsSpy.getCall(3).args).to.equal(['testerProgress', 'tls', 'NA', 'No tls testing available currently. The tls tester is currently in-active.']);
      expect(handleTesterProgressStub.getCall(3).args).to.equal(['tls', 'NA', 'No tls testing available currently. The tls tester is currently in-active.']);
    });


    it('- should subscribe to models tester events - should propagate initial tester responses from each tester to model, even if app tester is offline - then verify event flow back through presenter and then to view', async (flags) => {
      const { context: { configFileContents, rewiredApi, request, rewiredRequest, requestStub } } = flags;
      const apiResponse = [
        // Simulate no response from app tester to orchestrator.
        // {
        //   name: 'app',
        //   message: 'App tests are now running.'
        // },
        {
          name: 'server',
          message: 'No server testing available currently. The server tester is currently in-active.'
        },
        {
          name: 'tls',
          message: 'No tls testing available currently. The tls tester is currently in-active.'
        }
      ];

      requestStub.returns(Promise.resolve(apiResponse));
      const revertRewiredApiRequest = rewiredApi.__set__('request', requestStub);

      const testStub = sinon.stub(dashboard, 'test');
      dashboard.test = testStub;

      const rewiredHandleModelTesterEvents = rewiredApi.__get__('handleModelTesterEvents');
      const handleModelTesterEventsSpy = sinon.spy(rewiredHandleModelTesterEvents);
      const revertRewiredApiHandleModelTesterEvents = rewiredApi.__set__('handleModelTesterEvents', handleModelTesterEventsSpy);

      const handleTesterProgressStub = sinon.stub(dashboard, 'handleTesterProgress');
      dashboard.handleTesterProgress = handleTesterProgressStub;

      const revertRewiredApiDashboard = rewiredApi.__set__('dashboard', dashboard);
      const revertRewiredApiApiUrl = rewiredApi.__set__('apiUrl', `${apiUrl}`);

      flags.onCleanup = () => {
        rewiredRequest.post.restore();
        dashboard.test.restore();
        dashboard.handleTesterProgress.restore();
        revertRewiredApiRequest();
        revertRewiredApiHandleModelTesterEvents();
        revertRewiredApiDashboard();
        revertRewiredApiApiUrl();
      };

      await rewiredApi.test(configFileContents);

      expect(requestStub.getCall(0).args[0]).to.equal(request);
      expect(requestStub.callCount).to.equal(1);

      const expectedTesterSessions = [ // Taken from the model test
        { testerType: 'app', sessionId: 'lowPrivUser', threshold: 12 },
        { testerType: 'app', sessionId: 'adminUser', threshold: 0 },
        { testerType: 'server', sessionId: 'NA', threshold: 0 },
        { testerType: 'tls', sessionId: 'NA', threshold: 0 }
      ];

      expect(testStub.getCall(0).args[0]).to.equal(expectedTesterSessions);
      expect(testStub.callCount).to.equal(1);

      expect(handleModelTesterEventsSpy.callCount).to.equal(4);
      expect(handleTesterProgressStub.callCount).to.equal(4);

      expect(handleModelTesterEventsSpy.getCall(0).args).to.equal(['testerProgress', 'app', 'lowPrivUser', '"app" tester for session with Id "lowPrivUser" doesn\'t currently appear to be online']);
      expect(handleTesterProgressStub.getCall(0).args).to.equal(['app', 'lowPrivUser', '"app" tester for session with Id "lowPrivUser" doesn\'t currently appear to be online']);

      expect(handleModelTesterEventsSpy.getCall(1).args).to.equal(['testerProgress', 'app', 'adminUser', '"app" tester for session with Id "adminUser" doesn\'t currently appear to be online']);
      expect(handleTesterProgressStub.getCall(1).args).to.equal(['app', 'adminUser', '"app" tester for session with Id "adminUser" doesn\'t currently appear to be online']);

      expect(handleModelTesterEventsSpy.getCall(2).args).to.equal(['testerProgress', 'server', 'NA', 'No server testing available currently. The server tester is currently in-active.']);
      expect(handleTesterProgressStub.getCall(2).args).to.equal(['server', 'NA', 'No server testing available currently. The server tester is currently in-active.']);

      expect(handleModelTesterEventsSpy.getCall(3).args).to.equal(['testerProgress', 'tls', 'NA', 'No tls testing available currently. The tls tester is currently in-active.']);
      expect(handleTesterProgressStub.getCall(3).args).to.equal(['tls', 'NA', 'No tls testing available currently. The tls tester is currently in-active.']);
    });
  });


  describe('subscribeToTesterProgress SSE and handlers', async () => {
    before(async (flags) => {
      flags.context.apiResponse = [
        {
          name: 'app',
          message: 'App tests are now running.'
        },
        {
          name: 'server',
          message: 'No server testing available currently. The server tester is currently in-active.'
        },
        {
          name: 'tls',
          message: 'No tls testing available currently. The tls tester is currently in-active.'
        }
      ];
    });


    beforeEach(async (flags) => {
      const { context, context: { apiResponse } } = flags;
      const configFileContents = await context.buildUserConfigFileContent;
      context.model = new Model(configFileContents);
      const rewiredApi = rewire('src/presenter/apiDecoratingAdapter');
      rewiredApi.init(log);

      context.revertRewiredApiApiResponse = rewiredApi.__set__('apiResponse', apiResponse);
      context.revertRewiredApiEventSource = rewiredApi.__set__('EventSource', EventSource);

      context.rewiredSubscribeToTesterProgress = rewiredApi.__get__('subscribeToTesterProgress');
      context.rewiredApi = rewiredApi;
    });


    it('- given a mock event for each of the available testers sessions - given invocation of all the tester events - relevant handler instances should be run', async (flags) => {
      const { context: { model, rewiredSubscribeToTesterProgress, rewiredApi } } = flags;

      const numberOfEvents = 6;
      new MockEvent({ // eslint-disable-line no-new
        url: `${apiUrl}/app-lowPrivUser${TesterProgressRouteSuffix}`,
        setInterval: 1,
        responses: [
          { lastEventId: 'one', type: 'testerProgress', data: { progress: 'Initialising subscription to "app-lowPrivUser" channel for the event "testerProgress"' } },
          { lastEventId: 'two', type: 'testerPctComplete', data: { pctComplete: 8 } },
          { lastEventId: 'three', type: 'testerBugCount', data: { bugCount: 3 } }
        ]
      });
      new MockEvent({ // eslint-disable-line no-new
        url: `${apiUrl}/app-adminUser${TesterProgressRouteSuffix}`,
        setInterval: 1,
        responses: [
          { lastEventId: 'four', type: 'testerProgress', data: { progress: 'Initialising subscription to "app-adminUser" channel for the event "testerProgress"' } },
          { lastEventId: 'five', type: 'testerPctComplete', data: { pctComplete: 99 } },
          { lastEventId: 'six', type: 'testerBugCount', data: { bugCount: 7 } }
        ]
      });
      const eventHandled = { one: false, two: false, three: false, four: false, five: false, six: false };
      await new Promise((resolve) => {
        let handlerCallCount = 0;
        const checkExpectations = {
          one: (event, testerNameAndSessionToCheck) => {
            expect(event.type).to.equal('testerProgress');
            expect(event.data).to.equal({ progress: 'Initialising subscription to "app-lowPrivUser" channel for the event "testerProgress"' });
            expect(event.lastEventId).to.equal('one');
            expect(event.origin).to.equal(eventSourceOrigin);
            expect(testerNameAndSessionToCheck.testerType).to.equal('app');
            expect(testerNameAndSessionToCheck.sessionId).to.equal('lowPrivUser');
          },
          two: (event, testerNameAndSessionToCheck) => {
            expect(event.type).to.equal('testerPctComplete');
            expect(event.data).to.equal({ pctComplete: 8 });
            expect(event.lastEventId).to.equal('two');
            expect(event.origin).to.equal(eventSourceOrigin);
            expect(testerNameAndSessionToCheck.testerType).to.equal('app');
            expect(testerNameAndSessionToCheck.sessionId).to.equal('lowPrivUser');
          },
          three: (event, testerNameAndSessionToCheck) => {
            expect(event.type).to.equal('testerBugCount');
            expect(event.data).to.equal({ bugCount: 3 });
            expect(event.lastEventId).to.equal('three');
            expect(event.origin).to.equal(eventSourceOrigin);
            expect(testerNameAndSessionToCheck.testerType).to.equal('app');
            expect(testerNameAndSessionToCheck.sessionId).to.equal('lowPrivUser');
          },
          four: (event, testerNameAndSessionToCheck) => {
            expect(event.type).to.equal('testerProgress');
            expect(event.data).to.equal({ progress: 'Initialising subscription to "app-adminUser" channel for the event "testerProgress"' });
            expect(event.lastEventId).to.equal('four');
            expect(event.origin).to.equal(eventSourceOrigin);
            expect(testerNameAndSessionToCheck.testerType).to.equal('app');
            expect(testerNameAndSessionToCheck.sessionId).to.equal('adminUser');
          },
          five: (event, testerNameAndSessionToCheck) => {
            expect(event.type).to.equal('testerPctComplete');
            expect(event.data).to.equal({ pctComplete: 99 });
            expect(event.lastEventId).to.equal('five');
            expect(event.origin).to.equal(eventSourceOrigin);
            expect(testerNameAndSessionToCheck.testerType).to.equal('app');
            expect(testerNameAndSessionToCheck.sessionId).to.equal('adminUser');
          },
          six: (event, testerNameAndSessionToCheck) => {
            expect(event.type).to.equal('testerBugCount');
            expect(event.data).to.equal({ bugCount: 7 });
            expect(event.lastEventId).to.equal('six');
            expect(event.origin).to.equal(eventSourceOrigin);
            expect(testerNameAndSessionToCheck.testerType).to.equal('app');
            expect(testerNameAndSessionToCheck.sessionId).to.equal('adminUser');
          }
        };
        const handleServerSentTesterEvents = (event, receivedModel, testerNameAndSession) => {
          handlerCallCount += 1;

          expect(receivedModel).to.equal(model);

          if (eventHandled[event.lastEventId] === true) fail(`An event with a lastEventId of "${event.lastEventId}" was handled more than once.`);
          eventHandled[event.lastEventId] = true;
          checkExpectations[event.lastEventId](event, testerNameAndSession);

          if (handlerCallCount === numberOfEvents) resolve();
        };

        rewiredApi.__set__('handleServerSentTesterEvents', handleServerSentTesterEvents);

        rewiredSubscribeToTesterProgress(model);
      });

      flags.onCleanup = () => {
        expect(eventHandled.one).to.be.true();
        expect(eventHandled.two).to.be.true();
        expect(eventHandled.three).to.be.true();
        expect(eventHandled.four).to.be.true();
        expect(eventHandled.five).to.be.true();
        expect(eventHandled.six).to.be.true();
      };
    });


    afterEach((flags) => {
      const { context } = flags;
      context.revertRewiredApiApiResponse();
      context.revertRewiredApiEventSource();
    });
  });


  describe('getBuildUserConfigFile', async () => {
    before(async (flags) => {
      flags.context.buildUserConfigFileContent = await (async () => readFileAsync(buildUserConfigFilePath, { encoding: 'utf8' }))();
    });
    it('- should return the build user config file contents', async ({ context }) => {
      const { buildUserConfigFileContent } = context;
      api.init(log);
      const buildUserConfigFileContents = await api.getBuildUserConfigFile(buildUserConfigFilePath);
      expect(buildUserConfigFileContents).to.equal(buildUserConfigFileContent);
    });
  });
});