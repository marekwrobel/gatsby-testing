// const queryString = require('query-string');
const { initAccessToken, fetchCourses, fetchCoursesMock, fetchSubjectsMock } = require("./utils.js");

// const originalTimestamp = '2023-03-29T16:25:59Z'
// const laterTimeStamp = '2023-04-06T05:28:25.057Z'

// exports.onPreInit = async ({ cache }) => {
//   console.log('---- Loaded Sourcing Plugin ----');
// }

// exports.onPostBuild = async ({ cache }) => {
//   // set a timestamp at the end of the build
//   await cache.set(`last_fetched_timestamp`, Date.now())
// }

exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions;

  const typeDefs = `
    type LimitedSubject implements Node @dontInfer {
      uuid: String
    }
    type Subject implements Node @dontInfer {
      uuid: String
      name: String
      courses: [Course] @link(by: "subjects.elemMatch.uuid", from: "uuid")
    }
    type Course implements Node @dontInfer {
      uuid: Int
      title: String
      subjects: [LimitedSubject]
      xsubjects: [Subject] @link(by: "courses.elemMatch.uuid", from: "uuid")
    }
  `
  // Above we successfully added a field 'courses' to the Subject model 
  // that contains a list of course nodes related to this particular subject
  // We also added a field 'xsubjects' to the Course model
  // that contains a list of Subject nodes this course relates to
  // So the above is just a two way linking/binding these two models
  // TODO: figure out how to be able to call it "subjects" and still perform all linking
  // Right now, if we change xsubjects -> subjects it goes into indefinite loop

  // Query to confirm all working:
  // query MyQuery {
  //   allSubject {
  //   edges {
  //     node {
  //         uuid
  //         name
  //       courses {
  //           uuid
  //           title
  //         }
  //       }
  //     }
  //   }
  // allCourse {
  //   edges {
  //     node {
  //         uuid
  //         title
  //       subjects {
  //           uuid
  //         }
  //       xsubjects {
  //           uuid
  //           name
  //         }
  //       }
  //     }
  //   }

  // }
  createTypes(typeDefs)
}

const COURSE_NODE_TYPE = 'Course'
const SUBJECT_NODE_TYPE = 'Subject'
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
    const allCourseNodes = getNodesByType(COURSE_NODE_TYPE);
    allCourseNodes.forEach((node) => {
      touchNode(node)
    })
  } 

  isFirstSourceInCurrentNodeProcess = false;

  // FETCH ALL SUBJECTS
  const allSubjects = fetchSubjectsMock();

  // FETCH ALL OR ONLY UPDATED COURSES
  const fetchOnlyUpdatedCourses = false;
  const allCourses = fetchCoursesMock(fetchOnlyUpdatedCourses);

  // CREATE SUBJECT NODES
  allSubjects.forEach(subject =>
    createNode({
      ...subject,
      id: createNodeId(`${SUBJECT_NODE_TYPE}-${subject.uuid}`),
      parent: null,
      children: [],
      internal: {
        type: SUBJECT_NODE_TYPE,
        contentDigest: createContentDigest(subject),
      },
    })
  ) 

  // CREATE COURSE NODES
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

  return
}

// const COURSE_NODE_TYPE = 'Course'
// let isFirstSourceInCurrentNodeProcess = true;

// exports.sourceNodes = async ({
//   actions,
//   cache,
//   createContentDigest,
//   createNodeId,
//   getNodes,
//   getNodesByType,
//   reporter,
// }) => {

//   const { createNode, touchNode } = actions;

//   if (isFirstSourceInCurrentNodeProcess) {
//     // we need to loop over all nodes and touch them to tell gatsby that the 
// 		// node still exists and shouldn't be garbage collected
//     const allCourseNodes = getNodesByType(COURSE_NODE_TYPE);
//     allCourseNodes.forEach((node) => {
//       touchNode(node)
//     })
//   } 

//   isFirstSourceInCurrentNodeProcess = false;

//   // get the last timestamp from the cache
//   const lastFetchedTimestamp = laterTimeStamp //await cache.get(`last_fetched_timestamp`)

//   await initAccessToken();

//   reporter.info(`### Start Fetching Courses ###`)
//   const activity = reporter.activityTimer(`Fetching Courses`)
//   activity.start()
//   const allCourses = await fetchCourses(lastFetchedTimestamp);
//   activity.end()

//   // loop through data and create Gatsby nodes
//   allCourses.forEach(course =>
//     createNode({
//       ...course,
//       id: createNodeId(`${COURSE_NODE_TYPE}-${course.uuid}`),
//       parent: null,
//       children: [],
//       internal: {
//         type: COURSE_NODE_TYPE,
//         contentDigest: createContentDigest(course),
//       },
//     })
//   ) 

//   const courseNodesBefore = getNodesByType(COURSE_NODE_TYPE);

//   await createNode({
//     ...allCourses[0],
//     id: `qdup-${allCourses[0].nodeId}`,
//     parent: null,
//     children: [],
//     internal: {
//       type: COURSE_NODE_TYPE,
//       contentDigest: createContentDigest(allCourses[0]),
//     },
//   });

//   const courseNodesAfter = getNodesByType(COURSE_NODE_TYPE);


//   // const nodeExample = JSON.stringify(courseNodes[0])
//   // console.log(nodeExample)
//   reporter.info(`### courseNodesBefore: ${courseNodesBefore.length} ###`)
//   reporter.info(`### courseNodesAfter: ${courseNodesAfter.length} ###`)

//   return
// }