const path = require('path');

exports.createPages = async ({ graphql, actions }) => {
  const { createPage } = actions
  const queryResults = await graphql(`
    query {
      allCourse {
        nodes {
          uuid
          title
          lastUpdated
        }
      }
    }
  `)

  const courseTemplate = path.resolve(`src/templates/courseUpdated.js`)
  // queryResults.data.allCourse.nodes.forEach(node => {
  //   createPage({
  //     path: `/courses/${node.uuid}`,
  //     component: courseTemplate,
  //     context: {
  //       course: node,
  //     },
  //   })
  // })
  queryResults.data.allCourse.nodes.forEach(node => {
    createPage({
      path: `/courses/${node.uuid}`,
      component: courseTemplate,
      context: {
        uuid: node.uuid
      },
    })
  })
}