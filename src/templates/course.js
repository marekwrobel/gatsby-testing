import React, { useEffect, useState } from 'react';

function Course(props) {
  const { 
    pageContext: { 
      course 
    } 
  } = props;

  return (
    <>
      <h1>Course Page</h1>
      <div>course title: {course.title}</div>
    </>
  );
};

export default Course