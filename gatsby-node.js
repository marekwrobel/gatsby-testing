const path = require('path');

exports.onPreBuild = async ({
  cache,
}) => {
  // console.log("====== onPreBootstrap ========")
  // const v = await cache.get("VALUE");
  // console.log("GOT: ", v)
  //await cache.set("x", 10)

  // const currBTS = new Date().toJSON()
  // await cache.set('TS', currBTS);


   //process.env.ts = new Date().toJSON()
};

exports.onPostBuild = async ({
  cache,
}) => {
  // const ts = await cache.get("TS");
  // console.log("ts: ", ts)
  
  // console.log("====== onPostBootstrap ========")
  // const v = await cache.get("VALUE");
  // console.log("GOT: ", v)
  // const val = 501
  // await cache.set("VALUE", val)
  // console.log(`SET: ${val}`)
  console.log("testifsdfsdfsfnerewrwsdfsdfsdfergxxzz")
};

exports.createPages = async ({ graphql, actions }) => {
  const { createPage, cache } = actions
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