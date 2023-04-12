const path = require('path');

exports.onPreBootstrap = async ({
  cache,
}) => {
  // console.log("====== onPreBootstrap ========")
  // const v = await cache.get("VALUE");
  // console.log("GOT: ", v)
};

exports.onPostBootstrap = async ({
  cache,
}) => {
  // console.log("====== onPostBootstrap ========")
  // const v = await cache.get("VALUE");
  // console.log("GOT: ", v)
  // const val = 501
  // await cache.set("VALUE", val)
  // console.log(`SET: ${val}`)
  console.log("testingxx")
};

exports.createPages = async ({ graphql, actions }) => {
  const { createPage } = actions
  // const queryResults = await graphql(`
  //   query {
  //     allCourse {
  //       nodes {
  //         uuid
  //         title
  //         lastUpdated
  //       }
  //     }
  //   }
  // `)

  // const courseTemplate = path.resolve(`src/templates/courseUpdated.js`)
  // queryResults.data.allCourse.nodes.forEach(node => {
  //   createPage({
  //     path: `/courses/${node.uuid}`,
  //     component: courseTemplate,
  //     context: {
  //       course: node,
  //     },
  //   })
  // })
  // queryResults.data.allCourse.nodes.forEach(node => {
  //   createPage({
  //     path: `/courses/${node.uuid}`,
  //     component: courseTemplate,
  //     context: {
  //       uuid: node.uuid
  //     },
  //   })
  // })
}