import * as React from "react"
import { graphql } from "gatsby"

const HealthCheck = ({data}) => {
  const { info, cachedInfo } = data.buildInfoType;
  return (
    <>
      <div>Hello</div>
      <div>Info: {info}</div>
      <div>Cached Info: {cachedInfo}</div>
    </>
  )
};

export const query = graphql`
query MyQuery {
  	buildInfoType {
    	info
      cachedInfo
    }
  }
`

export default HealthCheck