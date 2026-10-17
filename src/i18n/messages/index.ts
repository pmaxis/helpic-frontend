/** All messages, by area. Each area's Ukrainian is typed as its English. */
import common from './common'
import auth from './auth'
import shell from './shell'
import tasks from './tasks'
import board from './board'
import people from './people'
import reports from './reports'
import dashboard from './dashboard'
import settings from './settings'

export const en = {
  ...common.en,
  ...auth.en,
  ...shell.en,
  ...tasks.en,
  ...board.en,
  ...people.en,
  ...reports.en,
  ...dashboard.en,
  ...settings.en,
}

export type MessageSchema = typeof en

export const uk: MessageSchema = {
  ...common.uk,
  ...auth.uk,
  ...shell.uk,
  ...tasks.uk,
  ...board.uk,
  ...people.uk,
  ...reports.uk,
  ...dashboard.uk,
  ...settings.uk,
}
