import * as path from '@stoplight/path';
import { Dictionary } from '@stoplight/types';
import { DiagnosticSeverity } from '@stoplight/types';
import * as nock from 'nock';
import { IRule, Rule } from '../../types';
import { readRulesFromRulesets } from '../reader';

const validFlatRuleset = path.join(__dirname, './__fixtures__/valid-flat-ruleset.json');
const validRequireInfo = path.join(__dirname, './__fixtures__/valid-require-info-ruleset.yaml');
const github447 = path.join(__dirname, './__fixtures__/github-issue-447-fixture.yaml');
const enabledAllRuleset = path.join(__dirname, './__fixtures__/enable-all-ruleset.json');
const invalidRuleset = path.join(__dirname, './__fixtures__/invalid-ruleset.json');
const extendsOas2Ruleset = path.join(__dirname, './__fixtures__/extends-oas2-ruleset.json');
const extendsUnspecifiedOas2Ruleset = path.join(__dirname, './__fixtures__/extends-unspecified-oas2-ruleset.json');
const extendsDisabledOas2Ruleset = path.join(__dirname, './__fixtures__/extends-disabled-oas2-ruleset.yaml');
const extendsOas2WithOverrideRuleset = path.join(__dirname, './__fixtures__/extends-oas2-with-override-ruleset.json');
const extendsRelativeRuleset = path.join(__dirname, './__fixtures__/extends-relative-ruleset.json');
const myOpenAPIRuleset = path.join(__dirname, './__fixtures__/my-open-api-ruleset.json');
const oasRuleset = require('../oas/index.json');
const oas2Ruleset = require('../oas2/index.json');
const oas3Ruleset = require('../oas3/index.json');

jest.setTimeout(10000);

describe('Rulesets reader', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('given flat, valid ruleset file should return rules', async () => {
    expect(await readRulesFromRulesets(validFlatRuleset)).toEqual({
      'valid-rule': {
        given: '$.info',
        message: 'should be OK',
        severity: DiagnosticSeverity.Warning,
        then: {
          function: 'truthy',
        },
      },
    });
  });

  it('given two flat, valid ruleset files should return rules', async () => {
    expect(await readRulesFromRulesets(validFlatRuleset, validRequireInfo)).toEqual({
      'valid-rule': {
        given: '$.info',
        message: 'should be OK',
        severity: DiagnosticSeverity.Warning,
        then: {
          function: 'truthy',
        },
      },
      'require-info': {
        given: '$.info',
        message: 'should be OK',
        severity: DiagnosticSeverity.Warning,
        then: {
          function: 'truthy',
        },
      },
    });
  });

  it('should inherit properties of extended rulesets', async () => {
    const rules = await readRulesFromRulesets(extendsOas2Ruleset);

    // we pick up *all* rules only from spectral:oas and spectral:oas2 and keep their severity level or set a default one
    expect(rules).toEqual({
      ...[...Object.entries(oasRuleset.rules), ...Object.entries(oas2Ruleset.rules)].reduce<Dictionary<unknown>>(
        (oasRules, [name, rule]) => {
          oasRules[name] = {
            ...rule,
            formats: expect.arrayContaining([expect.any(String)]),
            ...((rule as IRule).severity === undefined && { severity: DiagnosticSeverity.Warning }),
            then: expect.any(Object),
          };

          return oasRules;
        },
        {},
      ),

      'valid-rule': {
        given: '$.info',
        message: 'should be OK',
        severity: DiagnosticSeverity.Warning,
        then: {
          function: 'truthy',
        },
      },
    });
  });

  it('should inherit properties of extended rulesets and disable not recommended ones', () => {
    return expect(readRulesFromRulesets(extendsUnspecifiedOas2Ruleset)).resolves.toEqual({
      ...[...Object.entries(oasRuleset.rules), ...Object.entries(oas2Ruleset.rules)].reduce<Dictionary<unknown>>(
        (rules, [name, rule]) => {
          rules[name] = {
            ...rule,
            formats: expect.arrayContaining([expect.any(String)]),
            ...((rule as IRule).severity === undefined && { severity: DiagnosticSeverity.Warning }),
            ...(!(rule as IRule).recommended && { severity: -1 }),
            then: expect.any(Object),
          };

          return rules;
        },
        {},
      ),

      'valid-rule': {
        given: '$.info',
        message: 'should be OK',
        severity: DiagnosticSeverity.Warning,
        then: {
          function: 'truthy',
        },
      },
    });
  });

  // https://github.com/stoplightio/spectral/issues/447
  it('given GitHub issue #447, loads recommended oas3 and oas rules correctly', async () => {
    const readRules = await readRulesFromRulesets(github447);

    expect(readRules).toEqual({
      ...[...Object.entries(oasRuleset.rules), ...Object.entries(oas3Ruleset.rules)].reduce<Dictionary<unknown>>(
        (rules, [name, rule]) => {
          const formattedRule: Rule = {
            ...(rule as Rule),
            formats: expect.arrayContaining([expect.any(String)]),
            ...((rule as IRule).severity === undefined && { severity: DiagnosticSeverity.Warning }),
            ...(!(rule as IRule).recommended && { severity: -1 }),
            then: expect.any(Object),
          };

          rules[name] = formattedRule;

          if (name === 'operation-operationId') {
            formattedRule.severity = DiagnosticSeverity.Error;
          }

          if (name === 'operation-tags') {
            formattedRule.severity = DiagnosticSeverity.Hint;
          }

          return rules;
        },
        {
          'schema-names-pascal-case': {
            description: 'Schema names MUST be written in PascalCase',
            given: '$.components.schemas.*~',
            message: '{{property}} is not PascalCase: {{error}}',
            recommended: true,
            severity: DiagnosticSeverity.Warning,
            then: {
              function: 'pattern',
              functionOptions: {
                match: '^[A-Z][a-zA-Z0-9]*$',
              },
            },
            type: 'style',
          },
          'operation-id-kebab-case': {
            description: 'operationId MUST be written in kebab-case',
            given:
              "$.paths.*[?( @property === 'get' || @property === 'put' || @property === 'post' || @property === 'delete' || @property === 'options' || @property === 'head' || @property === 'patch' || @property === 'trace' )]",
            message: '{{property}} is not kebab-case: {{error}}',
            recommended: true,
            severity: DiagnosticSeverity.Warning,
            then: {
              field: 'operationId',
              function: 'pattern',
              functionOptions: {
                match: '^[a-z][a-z0-9\\-]*$',
              },
            },
            type: 'style',
          },
        },
      ),
    });
  });

  it('should set severity of disabled rules to off', () => {
    return expect(readRulesFromRulesets(extendsDisabledOas2Ruleset)).resolves.toEqual({
      ...[...Object.entries(oasRuleset.rules), ...Object.entries(oas2Ruleset.rules)].reduce<Dictionary<unknown>>(
        (rules, [name, rule]) => {
          rules[name] = {
            ...rule,
            formats: expect.arrayContaining([expect.any(String)]),
            severity: -1,
            then: expect.any(Object),
          };

          return rules;
        },
        {},
      ),

      'operation-operationId-unique': {
        // value of oasRuleset.rules['operation-operationId-unique']
        description: 'Every operation must have a unique `operationId`.',
        formats: expect.arrayContaining([expect.any(String)]),
        recommended: true,
        type: 'validation',
        severity: 0,
        given: '$',
        then: {
          function: 'oasOpIdUnique',
        },
        tags: ['operation'],
      },
    });
  });

  it('should override properties of extended rulesets', () => {
    return expect(readRulesFromRulesets(extendsOas2WithOverrideRuleset)).resolves.toHaveProperty(
      'operation-2xx-response',
      {
        description: 'should be overridden',
        given: '$.info',
        formats: expect.arrayContaining([expect.any(String)]),
        recommended: true,
        severity: DiagnosticSeverity.Warning,
        tags: ['operation'],
        then: {
          function: 'truthy',
        },
        type: 'style',
      },
    );
  });

  it('should persist disabled properties of extended rulesets', () => {
    return expect(readRulesFromRulesets(extendsOas2WithOverrideRuleset)).resolves.toHaveProperty(
      'operation-security-defined',
      {
        given: '$',
        recommended: true,
        formats: expect.arrayContaining([expect.any(String)]),
        severity: -1,
        description: 'Operation `security` values must match a scheme defined in the `securityDefinitions` object.',
        tags: ['operation'],
        then: {
          function: 'oasOpSecurityDefined',
          functionOptions: {
            schemesPath: ['securityDefinitions'],
          },
        },
        type: 'validation',
      },
    );
  });

  it('should prefer top-level ruleset severity level', async () => {
    const enabledRules = await readRulesFromRulesets(enabledAllRuleset);
    expect(enabledRules).toEqual(
      [...Object.entries(oasRuleset.rules), ...Object.entries(oas2Ruleset.rules)].reduce<Dictionary<unknown>>(
        (rules, [name, rule]) => {
          rules[name] = {
            ...rule,
            formats: expect.arrayContaining([expect.any(String)]),
            ...((rule as IRule).severity === undefined && { severity: DiagnosticSeverity.Warning }),
            then: expect.any(Object),
          };

          return rules;
        },
        {},
      ),
    );

    // let's make sure all rules are enabled
    expect(
      Object.values(enabledRules).filter(
        rule => rule.severity === -1 || rule.severity === 'off' || rule.severity === undefined,
      ),
    ).toHaveLength(0);
  });

  it('should limit the scope of formats to a ruleset', () => {
    return expect(readRulesFromRulesets(myOpenAPIRuleset)).resolves.toEqual({
      ...Object.entries(oasRuleset.rules).reduce<Dictionary<unknown>>((rules, [name, rule]) => {
        rules[name] = expect.objectContaining({
          formats: ['oas2', 'oas3'],
        });

        return rules;
      }, {}),

      ...Object.entries(oas2Ruleset.rules).reduce<Dictionary<unknown>>((rules, [name, rule]) => {
        rules[name] = expect.objectContaining({
          formats: ['oas2'],
        });

        return rules;
      }, {}),

      ...Object.entries(oas3Ruleset.rules).reduce<Dictionary<unknown>>((rules, [name, rule]) => {
        rules[name] = expect.objectContaining({
          formats: ['oas3'],
        });

        return rules;
      }, {}),

      'valid-rule': expect.objectContaining({
        message: 'should be OK',
      }),
    });
  });

  it('should support local rulesets', () => {
    return expect(readRulesFromRulesets(extendsRelativeRuleset)).resolves.toEqual({
      PascalCase: {
        given: '$',
        message: 'bar',
        severity: -1, // turned off, cause it's not recommended
        then: {
          function: 'truthy',
        },
      },
      camelCase: {
        given: '$',
        message: 'bar',
        recommended: true,
        severity: DiagnosticSeverity.Warning,
        then: {
          function: 'truthy',
        },
      },
      snake_case: {
        given: '$',
        message: 'foo',
        severity: DiagnosticSeverity.Warning,
        then: {
          function: 'truthy',
        },
      },
    });
  });

  it('should resolve oas2-schema', async () => {
    const rules = await readRulesFromRulesets('spectral:oas2');
    expect(rules['oas2-schema']).not.toHaveProperty('then.functionOptions.schema.$ref');
    expect(rules['oas2-schema']).toHaveProperty(
      'then.functionOptions.schema',
      expect.objectContaining({
        title: 'A JSON Schema for Swagger 2.0 API.',
        id: 'http://swagger.io/v2/schema.json#',
        $schema: 'http://json-schema.org/draft-04/schema#',
      }),
    );
  });

  it('should resolve oas3-schema', async () => {
    const rules = await readRulesFromRulesets('spectral:oas3');
    expect(rules['oas3-schema']).not.toHaveProperty('then.functionOptions.schema.$ref');
    expect(rules['oas3-schema']).toHaveProperty(
      'then.functionOptions.schema',
      expect.objectContaining({
        id: 'https://spec.openapis.org/oas/3.0/schema/2019-04-02',
        $schema: 'http://json-schema.org/draft-04/schema#',
        description: 'Validation schema for OpenAPI Specification 3.0.X.',
      }),
    );
  });

  it('given non-existent ruleset should output error', () => {
    nock('https://unpkg.com')
      .get('/oneParentRuleset')
      .reply(404);

    return expect(readRulesFromRulesets('oneParentRuleset')).rejects.toThrowError(
      'Could not parse https://unpkg.com/oneParentRuleset: Not Found',
    );
  });

  it('given invalid ruleset should output errors', () => {
    return expect(readRulesFromRulesets(invalidRuleset)).rejects.toThrowError(/should have required property/);
  });
});