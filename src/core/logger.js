const winston = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')
const path = require('path')
const os = require('os')
const fs = require('fs')

const fmt = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
      return `${timestamp} [${level}] ${message}${extra}`
    })
  )
})

// ETHSMITH_LOG_FILE: set by the --log-file CLI option before this module is required.
// When set, logs go to that exact file instead of the default daily-rotate directory.
const customLogFile = process.env.ETHSMITH_LOG_FILE

let fileTransport
if (customLogFile) {
  fs.mkdirSync(path.dirname(customLogFile), { recursive: true })
  fileTransport = new winston.transports.File({
    filename: customLogFile,
    format: fmt
  })
} else {
  const LOG_DIR = path.join(os.homedir(), '.ethsmith', 'logs')
  fs.mkdirSync(LOG_DIR, { recursive: true })
  fileTransport = new DailyRotateFile({
    dirname: LOG_DIR,
    filename: 'ethsmith-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '100m',
    maxFiles: '14d',
    format: fmt
  })
}

const logger = winston.createLogger({
  level: process.env.ETHSMITH_LOG_LEVEL || 'info',
  format: fmt,
  transports: [consoleTransport, fileTransport]
})

module.exports = logger
