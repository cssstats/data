const fs = require('fs')
const path = require('path')
const fetch = require('isomorphic-fetch')
const pLimit = require('p-limit')
const waybackCss = require('wayback-css')
const globby = require('globby')
const mkdirp = require('mkdirp')

const limit = pLimit(1)

const SITE = 'github.com'
const SITE_NAME = 'github'

const getEndDate = () => {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate()
  }
}

const getStartDate = async ({ url, name }) => {
  const basePath = path.join(__dirname, 'data', name)
  const files = await globby(basePath)
  if (files.length) {
    const last = files.pop()
    const date = path.parse(last).name
    const year = date.slice(0, 4)
    const month = date.slice(4, 6)
    const day = date.slice(6, 8)

    console.log('Continuing from year', year)
    return { year, month, day }
  }

  const result = await fetch(`https://archive.org/wayback/available?url=${url}&timestamp=19800101`)
  const data = await result.json()
  const date = data.archived_snapshots.closest.timestamp

  const year = date.slice(0, 4)
  const month = date.slice(4, 6)
  const day = date.slice(6, 8)

  console.log('Start date', year, month, day)

  return { year, month, day }
}

const getDates = async ({ url, name }) => {
  const endDate = getEndDate()
  const startDate = await getStartDate({ url, name })

  const dates = []

  for (let year = startDate.year; year <= endDate.year; year++) {
    for (let month = 1; month <= 12; month++) {
      dates.push({
        year: year.toString(),
        month: month.toString().padStart(2, '0'),
        day: '01'
      })
      dates.push({
        year: year.toString(),
        month: month.toString().padStart(2, '0'),
        day: '15'
      })
    }
  }

  return dates
}

const fetchData = async ({ url, name }) => {
  const basePath = path.join(__dirname, 'data', name)
  mkdirp.sync(basePath)

  const dates = await getDates({ url, name })

  const allScrapes = dates.map(date => {
    return limit(async () => {
      const fullDate = [date.year, date.month, date.day].join('')
      console.log('fetching for', fullDate, url)
      const css = await waybackCss(url, fullDate)

      fs.writeFileSync(path.join(basePath, fullDate) + '.json', JSON.stringify(css))
      console.log('fetched', fullDate)
    })
  })

  await Promise.all(allScrapes)
}

;(async () => {
  console.log('Beginning CSS scraping')
  await fetchData({ url: SITE, name: SITE_NAME })
  console.log('Finished CSS scraping')
})()
