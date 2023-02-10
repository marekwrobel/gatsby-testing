// const queryString = require('query-string');
const { initAccessToken, fetchCourses } = require("./utils.js");

exports.onPreInit = () => console.log('Loaded gatsby-plugin-source-api');

exports.onPostBuild = async ({ cache }) => {
  // set a timestamp at the end of the build
  await cache.set(`timestamp`, Date.now())
}

const COURSE_NODE_TYPE = 'Course'
let isFirstSourceInCurrentNodeProcess = true;

exports.sourceNodes = async ({
  actions,
  cache,
  createContentDigest,
  createNodeId,
  getNodes,
  reporter,
}) => {

  const { createNode, touchNode, deleteNode } = actions;
  
  // if (isFirstSourceInCurrentNodeProcess) {
		
	// 	// getNodes gets an array of all gatsby nodes
	// 	// Alternately, you can also getNodesByType
  //   const allNodes = getNodes();

  //   allNodes.forEach((node) => {
	// 			// we loop over all nodes here and touch them to tell gatsby that the 
	// 			// node still exists and shouldn't be garbage collected
	// 			// touchNode documentation
  //       touchNode(node)
  //   })
  // } 

  // isFirstSourceInCurrentNodeProcess = false;

  // // get the last timestamp from the cache
  // const lastFetched = 1673465257758 //await cache.get(`timestamp`)
  // const pageNumber = 1
  // let nextPageUrl = `http://localhost:3000/courses?lastUpdated=${lastFetched}&pageNumber=${pageNumber}`;
  // let results = [];




  await initAccessToken();

  const activity = reporter.activityTimer(`############################## Fetching Courses`)
  activity.start()
  const allCourses = await fetchCourses();
  activity.end()
  reporter.info(`########### Total Courses: ${allCourses.length}`)






  // TODO: delete nodes manually (deleteNode)
  // actions.deleteNode(getNode(createNodeId(id)))

  // loop through data and create Gatsby nodes
  // results.forEach(course =>
  //   createNode({
  //     ...course,
  //     id: createNodeId(`${COURSE_NODE_TYPE}-${course.uuid}`),
  //     parent: null,
  //     children: [],
  //     internal: {
  //       type: COURSE_NODE_TYPE,
  //       contentDigest: createContentDigest(course),
  //     },
  //   })
  // )

  

  return
}