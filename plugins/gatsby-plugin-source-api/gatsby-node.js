// const queryString = require('query-string');
const { initAccessToken, fetchCourses } = require("./utils.js");

const originalTimestamp = '2023-03-29T16:25:59Z'
const laterTimeStamp = '2023-03-29T20:30:59Z'

exports.onPreInit = async ({ cache }) => {
  console.log('---- Loaded Sourcing Plugin ----');
}

exports.onPostBuild = async ({ cache }) => {
  // set a timestamp at the end of the build
  await cache.set(`last_fetched_timestamp`, Date.now())
}

const COURSE_NODE_TYPE = 'Course'
let isFirstSourceInCurrentNodeProcess = true;

exports.sourceNodes = async ({
  actions,
  cache,
  createContentDigest,
  createNodeId,
  getNodes,
  getNodesByType,
  reporter,
}) => {

  const { createNode, touchNode } = actions;

  if (isFirstSourceInCurrentNodeProcess) {
    // we need to loop over all nodes and touch them to tell gatsby that the 
		// node still exists and shouldn't be garbage collected
    const allCourseNodes = getNodesByType(COURSE_NODE_TYPE);
    allCourseNodes.forEach((node) => {
      touchNode(node)
    })
  } 

  isFirstSourceInCurrentNodeProcess = false;

  // get the last timestamp from the cache
  const lastFetchedTimestamp = laterTimeStamp //await cache.get(`last_fetched_timestamp`)

  await initAccessToken();

  reporter.info(`### Start Fetching Courses ###`)
  const activity = reporter.activityTimer(`Fetching Courses`)
  activity.start()
  const allCourses = await fetchCourses(lastFetchedTimestamp);
  activity.end()

  // loop through data and create Gatsby nodes
  allCourses.forEach(course =>
    createNode({
      ...course,
      id: createNodeId(`${COURSE_NODE_TYPE}-${course.uuid}`),
      parent: null,
      children: [],
      internal: {
        type: COURSE_NODE_TYPE,
        contentDigest: createContentDigest(course),
      },
    })
  ) 

  const courseNodes = getNodesByType(COURSE_NODE_TYPE);
  reporter.info(`### Total Fetched Courses: ${allCourses.length} ###`)
  reporter.info(`### Total Course Nodes: ${courseNodes.length} ###`)

  return
}