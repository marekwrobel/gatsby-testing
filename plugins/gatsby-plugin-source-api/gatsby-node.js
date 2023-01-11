exports.onPreInit = () => console.log('Loaded gatsby-plugin-source-api');

exports.onPostBuild = async ({ cache }) => {
  // set a timestamp at the end of the build
  await cache.set(`timestamp`, Date.now())
}

const COURSE_NODE_TYPE = 'Course'

exports.sourceNodes = async ({
  actions,
  cache,
  createContentDigest,
  createNodeId,
}) => {
  const { createNode } = actions;

  // get the last timestamp from the cache
  const lastFetched = 1673465257758 //await cache.get(`timestamp`)
  const pageNumber = 1
  let nextPageUrl = `http://localhost:3000/courses?lastUpdated=${lastFetched}&pageNumber=${pageNumber}`;
  let results = [];

  // pull data from API using cached data as an option in the request
  while (nextPageUrl) {
    const response = await fetch(nextPageUrl)
    const result = await response.json()
    if (result.data) {
      results = [...results, ...result.data]
    }    
    nextPageUrl = result.next;
  }

  // loop through data and create Gatsby nodes
  results.forEach(course =>
    createNode({
      ...course,
      id: createNodeId(`${COURSE_NODE_TYPE}-${course.id}`),
      parent: null,
      children: [],
      internal: {
        type: COURSE_NODE_TYPE,
        contentDigest: createContentDigest(course),
      },
    })
  )

  return
}