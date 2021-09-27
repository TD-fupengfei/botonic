import { createCms } from '../../../src/factories'
import { CMS, SupportedLocales } from '../../../src/cms'
import { DirectusOptions } from '../../../src/plugin'

export function testDirectus(): CMS {
  return createCms(testDirectusOptions())
}

export function testDirectusOptions(): DirectusOptions {
  return {
    credentials: {
      token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9kldsncuierUYVRTCVL87',
      apiEndPoint:
        'http://test-cms-directus-alb-1959632461.eu-west-1.elb.amazonaws.com:8055/',
    },
    keywordOptions: {},
  }
}

export function testContext(): SupportedLocales {
  return SupportedLocales.ENGLISH
}
