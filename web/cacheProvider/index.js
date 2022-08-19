import nodeCache from 'node-cache'
let cache = null

export const start = (done) => {
  if (cache) return done()

  cache = new nodeCache()
  console.log('cache service started')
}

export const instance = () => {
  return cache
}

export const clear = () => {
  cache = new nodeCache()
  console.log('cache service started')
}