import * as React from "react"
import { graphql } from "gatsby"

const Course = ({ data }) => (
  <pre>{JSON.stringify(data, null, 2)}</pre>
)

// export const query = graphql`
//   query($uuid: Int){
//     course(uuid: {eq: $uuid}) {
//       id
//       title
//       lastUpdated
//     }
//   }
// `

export default Course