const { reporter } = require('gatsby-cli/lib/reporter/reporter');
const queryString = require('query-string');

let options = {};

const initAccessToken = async () => {
  const accessBody = {
    grant_type: 'client_credentials',
    client_id: process.env.OAUTH_ID,
    client_secret: process.env.OAUTH_SECRET,
    token_type: 'jwt',
  };

  const response = await fetch(process.env.OAUTH_URL, {
    method: 'POST',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: queryString.stringify(accessBody),
  });
  
  const oauthResponse = await response.json();

  if (!response.ok) {
    const errorMessage = 'Failure to get Auth token, please confirm your OAUTH credentials.';
    if (process.env.OAUTH_IGNORE !== 'true') {
      // eslint-disable-next-line no-console
      console.error(new Error(errorMessage));
      process.exit(1);
    }
  }
  
  const accessToken = oauthResponse.access_token
  
  options = {
    headers: {
      Authorization: `JWT ${accessToken}`,
    },
  }
};

const fetchCourses = async (lastFetchedTimestamp) => {
  let allCourses = [];
  let pageNumber = 1;
  let nextPageUrl = `https://discovery.edx.org/api/v1/courses?timestamp=${lastFetchedTimestamp}&pageNumber=${pageNumber}`;

  while (nextPageUrl) {
    const pageFetching = reporter.activityTimer(`Fetching Page ${pageNumber}`)
    pageFetching.start()
    const response = await fetch(nextPageUrl, options)
    const responseJSON = await response.json()
    pageFetching.end()
    if (responseJSON.results) {
      allCourses = [...allCourses, ...responseJSON.results]
    }    
    pageNumber++
    nextPageUrl = responseJSON.next;
  }
  return allCourses;
}

const allSubjects = [
  {
    'uuid': 'A',
    'name': 'Subject A'
  },
  {
    'uuid': 'B',
    'name': 'Subject B'
  },
  {
    'uuid': 'C',
    'name': 'Subject C'
  },
]

const allCourses = [
  {
    'uuid': 1,
    'title': 'Course 1',
    'subjects': [
      {
        'uuid': 'A',
      },
    ]
  },
  {
    'uuid': 2,
    'title': 'Course 2',
    'subjects': [
      {
        'uuid': 'B',
      },
    ]
  },
  {
    'uuid': 3,
    'title': 'Course 3',
    'subjects': [
      {
        'uuid': 'C',
      },
    ]
  },
  {
    'uuid': 4,
    'title': 'Course 4',
    'subjects': [
      {
        'uuid': 'A',
      },
    ]
  },
  {
    'uuid': 5,
    'title': 'Course 5',
    'subjects': [
      {
        'uuid': 'B',
      },
      {
        'uuid': 'C',
      },
    ]
  },
]

const updatedCourses = [
  {
    'uuid': 1,
    'title': 'Course 1 Updated',
    'subjects': [
      {
        'uuid': 'A',
      },
      {
        'uuid': 'B',
      },
    ]
  },
  {
    'uuid': 2,
    'title': 'Course 2 Updated',
    'subjects': [
      {
        'uuid': 'C',
      },
    ]
  },
]

const fetchSubjectsMock = () => allSubjects;

const fetchCoursesMock = (fetchOnlyUpdatedCourses = false) => fetchOnlyUpdatedCourses ? updatedCourses : allCourses;


module.exports = {
  initAccessToken,
  fetchCourses,
  fetchSubjectsMock,
  fetchCoursesMock
}