// Disable no-console warnings since this file is part of our build process
/* eslint no-console: 0 */
/* eslint-disable no-param-reassign, consistent-return */

const fetch = require('node-fetch');
const queryString = require('query-string');
const Bottleneck = require('bottleneck');
const { createNodeHelpers } = require('gatsby-node-helpers');
const ProgressBar = require('progress');
const algoliasearch = require('algoliasearch/lite');

const discoverySourceUtils = require('../../src/source-utils/discovery');
const programSourceUtils = require('../../src/source-utils/programs');
const courseSourceUtils = require('../../src/source-utils/courses');
const subjectSourceUtils = require('../../src/source-utils/subjects');
const topicSourceUtils = require('../../src/source-utils/topics');
const { camelCaseObject } = require('../../src/build-utils/helpers/fieldRenaming');
const typeDefs = require('../../schema/types.gql');
const SNAPSHOTS = require('./response-snapshots');

const {
  dummyHomepageCourseUUIDs,
  singleTestCourseUUID,
  singleTestArchivedCourseUUID,
  singleTestUnenrollableCourseUUID,
  singleTestExecEdCourseUUID,
  courseWithRedirectUUID,
  singleTestProgramUUID,
  singleMastersProgramUUID,
  singleBachelorsDegreeUUID,
  singleTestProgramCourseUUIDs,
  singleDataPlaceholderProgramUUID,
  twoTrackProgramUUID,
  twoTrackProgramCourseUUIDs,
  linkedProgramUUID,
  linkedProgramCourseUUIDs,
  limitedBootCampUUIDs,
} = require('../../src/source-utils/constants');

const {
  courseWithRecommendations,
  firstRecommendation,
  secondRecommendation,
  thirdRecommendation,
  fourthRecommendation,
  experimentCoursesWithRecommendations,
} = require('../../src/source-utils/exp_constants');

const {
  promotedProgramUuidsEN,
  promotedProgramUuidsES,
  promotedCourseUuidsEN,
  promotedCourseUuidsES,
  allPromotedProductUuidsAndTypes,
} = require('../../src/build-utils/pages/search');

const COURSE_TYPE = 'Course';
const SUBJECT_TYPE = 'Subject';
const PROGRAM_TYPE = 'Program';
const TOPIC_TYPE = 'Topic';
const ORGANIZATION_TYPE = 'Organization';
const CURRENCY_TYPE = 'Currency';
const INITIAL_SEARCH_REFINEMENT_TYPE = 'SearchRefinement';

const limitedCourseUUIDs = [
  singleTestCourseUUID,
  courseWithRedirectUUID,
  singleTestArchivedCourseUUID,
  singleTestUnenrollableCourseUUID,
  singleTestExecEdCourseUUID,
  courseWithRecommendations,
  firstRecommendation,
  secondRecommendation,
  thirdRecommendation,
  fourthRecommendation,
]
  .concat(
    dummyHomepageCourseUUIDs,
    singleTestProgramCourseUUIDs,
    promotedCourseUuidsEN,
    promotedCourseUuidsES,
    twoTrackProgramCourseUUIDs,
    linkedProgramCourseUUIDs,
    limitedBootCampUUIDs,
    allPromotedProductUuidsAndTypes.filter(([, type]) => type === 'course').map(([uuid]) => uuid),
  );
const limitedProgramUUIDs = [singleTestProgramUUID,
  linkedProgramUUID,
  twoTrackProgramUUID,
  singleMastersProgramUUID,
  singleBachelorsDegreeUUID,
  singleDataPlaceholderProgramUUID]
  .concat(
    promotedProgramUuidsEN,
    promotedProgramUuidsES,
    allPromotedProductUuidsAndTypes.filter(([, type]) => type === 'program').map(([uuid]) => uuid),
  );

exports.createSchemaCustomization = async ({ actions }) => {
  const { createTypes } = actions;
  createTypes(typeDefs);
};

exports.sourceNodes = async ({
  cache, actions, createNodeId, createContentDigest, reporter, parentSpan,
}, configOptions) => {
  try {
    const { createNode } = actions;
    const {
      createNodeFactory,
      createNodeId: generateNodeId,
    } = createNodeHelpers({
      typePrefix: '',
      createNodeId,
      createContentDigest,
    });
    const topicNode = createNodeFactory(TOPIC_TYPE);
    const currencyNode = createNodeFactory(CURRENCY_TYPE);
    // Gatsby adds a configOption that's not needed for this plugin, delete it
    delete configOptions.plugins;

    const status = {
      bar: new ProgressBar('Sourcing :type [:bar] :current/:total :elapsed secs :percent', {
        width: 30,
        total: 0,
      }),
    };

    const updateStatus = (type) => {
      status.bar.tick(1, { type });
    };

    const accessTokenHeader = await discoverySourceUtils.getAccessTokenHeader();

    // Rate limits requests to a maximum of ~200 requests / minute.
    const ecommerceLimiter = new Bottleneck({
      minTime: 300, // Time between requests in ms
      maxConcurrent: 3,
    });

    // Rate limits to 300 requests / second (from this build; note that there are often multiple
    // builds in progress at any given time).
    const discoveryLimiter = new Bottleneck({
      minTime: 200,
      maxConcurrent: 3,
    });

    const limitTries = 20;

    const browseClient = algoliasearch(
      process.env.GATSBY_ALGOLIA_APP_ID,
      process.env.PROSPECTUS_ALGOLIA_ADMIN_KEY,
    );

    const searchClient = algoliasearch(
      process.env.GATSBY_ALGOLIA_APP_ID,
      process.env.GATSBY_ALGOLIA_SEARCH_KEY,
    );

    const browseIndexEN = browseClient.initIndex('product');
    const browseIndexES = browseClient.initIndex('spanish_product');
    const searchIndexEN = searchClient.initIndex('product');
    const searchIndexES = searchClient.initIndex('spanish_product');

    const getRandomWaitTime = () => {
      const minWait = 2000; // millis
      const maxWait = 30000;
      return Math.floor(Math.random() * (maxWait - minWait + 1) + minWait);
    };

    const fetchWithRetry = async (url, options, n = limitTries) => {
      try {
        const [snapshotExists, snapshottedResponse] = await SNAPSHOTS.attemptFetch(url);
        if (snapshotExists) {
          reporter.info(`using snapshotted data for ${url}`);
          return snapshottedResponse;
        }
        const response = await fetch(url, options);
        if (!response.ok) {
          const errorDetails = response.text;
          const errorMessage = response.status.toString().concat(' ', errorDetails);
          throw new Error(errorMessage);
        }
        const data = await response.json();
        const finalResponse = { headers: response.headers, data };
        SNAPSHOTS.saveResponse(finalResponse, url);
        return finalResponse;
      } catch (err) {
        // also here will print in console the entire error on every attempt
        console.log(err.message);
        console.log(`Retrying the call to ${url}. This is attempt ${limitTries + 1 - n} out of ${limitTries}.`);
        if (n === 1) {
          throw new Error(`Failed fetching ${url}: ${err}`);
          // This will print also the error code, as it does not come in a diferent property
        }
        const waitTime = getRandomWaitTime();
        console.log(`Sleeping for ${waitTime} milliseconds...`);
        await new Promise(resolve => {
          setTimeout(resolve, waitTime);
        });

        return fetchWithRetry(url, options, n - 1);
      }
    };

    // Course API Calls
    const fetchCourses = async (paginationUrl, courseList, coursesMissingSubjects = []) => {
      try {
        const response = await fetchWithRetry(paginationUrl, accessTokenHeader);
        const { data } = response;
        status.bar.total = data.count;

        // Process courses in response
        data.results.forEach((course) => {
          courseList.push(courseSourceUtils.processCourse(course, createNodeId));
          if (course.subjects.length === 0 && course.inProspectus) {
            coursesMissingSubjects.push(`Course with title - ${course.title}, UUID - ${course.uuid}, and slug - ${course.url_slug} is missing subject`);
          }
          updateStatus('courses');
        });

        if (data.next) {
          const nextPageUrl = discoverySourceUtils.getNextPage(data);
          await fetchCourses(nextPageUrl, courseList, coursesMissingSubjects);
        } else if (coursesMissingSubjects.length > 0) {
          const missingSubjectError = coursesMissingSubjects.join('\n');
          throw new Error(missingSubjectError);
        }
      } catch (err) {
        console.error('fetchCourses failed', err);
        process.exit();
      }
      return courseList;
    };

    // Fetch v1 bundling skus (courses without entitlements)
    const fetchMissingEntitlementCourses = async (skus, missingCourses) => {
      // Convert the options object into a query string
      const missingEntitlementCoursesApiQueryParams = {
        uuids: missingCourses.map(uuid => uuid.uuid),
        ...configOptions.courseParameters,
      };

      const fullBaseURL = `${process.env.DISCOVERY_HOST_URL}${process.env.DISCOVERY_API_PATH}courses`;
      const coursesByUUIDUrl = `${fullBaseURL}?${queryString.stringify(missingEntitlementCoursesApiQueryParams, { arrayFormat: 'comma' })}`;

      try {
        const response = await fetchWithRetry(coursesByUUIDUrl, accessTokenHeader);
        const { data } = response;

        data.results.forEach((course) => {
          const missingCourse = courseSourceUtils.processCourse(course, createNodeId);
          // TODO: rm missingCourse.active_course_run when SCUrl becomes permanent (WEBSITE-230)
          const activeCourseRun = missingCourse.active_course_run || missingCourse.activeCourseRun;
          if (activeCourseRun) {
            const rankedSeats = activeCourseRun.seats.map(({ type, sku }) => {
              if (type === 'verified') {
                return { sku, rank: 1 };
              }
              if (type === 'professional') {
                return { sku, rank: 1 };
              }
              return { sku, rank: 2 };
            });
            rankedSeats.sort(({ rank: aRank }, { rank: bRank }) => ((aRank > bRank) ? 1 : -1));
            const [seat] = rankedSeats;
            if (seat) {
              skus.push(seat.sku);
            } else {
              console.warn(`No seat available for program course [${missingCourse.title}] with uuid [${missingCourse.uuid}] - no sku used for program price`);
            }
            console.info(`Entitlement missing for program course [${missingCourse.title}] with uuid [${missingCourse.uuid}] - using active run seat sku`);
          } else {
            console.warn(`No active course run for program course [${missingCourse.title}] with uuid [${missingCourse.uuid}] - no sku used for program price`);
          }
        });
      } catch (err) {
        console.error('fetchMissingEntitlementCourses failed', err);
      }
    };

    // Program API Calls
    const fetchEcommerceProgramData = async (program) => {
      // Get relevant ecommerce product SKUs from the program's course's entitlements
      const skus = [];
      const coursesWithNoEntitlements = [];
      program.courses.forEach((course) => {
        if (course.entitlements.length === 0) {
          coursesWithNoEntitlements.push(course);
        }
        course.entitlements.forEach((entitlement) => {
          if (entitlement.mode === 'verified'
            || entitlement.mode === 'professional') {
            if (entitlement.sku) {
              skus.push(entitlement.sku);
            } else {
              console.warn(`Program [${program.title}] with uuid [${program.uuid}] has incorrectly set skus`);
            }
          }
        });
      });
      // Fetch skus for courses that don't have entitlements
      if (coursesWithNoEntitlements.length > 0) {
        await fetchMissingEntitlementCourses(skus, coursesWithNoEntitlements);
      }
      // Fetch Program price and prepare basket URL if we have SKUs
      if (skus.length > 0) {
        // Build query params
        const basketCalculateQueryParameters = {
          is_anonymous: true,
        };
        basketCalculateQueryParameters.sku = [];
        skus.forEach((sku) => {
          basketCalculateQueryParameters.sku.push(sku);
        });

        basketCalculateQueryParameters.bundle = program.uuid;

        // Build URLs for price fetch via API and BasketSummary view for runtime link
        const basketCalculateUrl = `${process.env.ECOMMERCE_BASKET_CALCULATE_API}?${queryString.stringify(basketCalculateQueryParameters, { arrayFormat: 'none' })}`;

        // Rate limit ecommerce requests
        try {
          let response = await ecommerceLimiter.schedule(() => fetchWithRetry(basketCalculateUrl, accessTokenHeader));
          let ecommerceData = response.data;

          if (process.env.GATSBY_ENVIRONMENT === 'development'
            && response.headers.get('x-cache-status') === 'HIT') {
            // Shut off local ecommerce throttling if the ecommerce results are cached
            ecommerceLimiter.updateSettings({
              minTime: 0,
              maxConcurrent: null,
            });
          }
          if (Number.isNaN(ecommerceData.total_incl_tax)
            || Number.isNaN(ecommerceData.total_incl_tax_excl_discounts)) {
            // retry if non-numbers show up in response
            response = await ecommerceLimiter.schedule(() => fetchWithRetry(basketCalculateUrl, accessTokenHeader));
            ecommerceData = response.data;
          }
          program.programPrice = ecommerceData.total_incl_tax;
          program.programOriginalPrice = ecommerceData.total_incl_tax_excl_discounts;
          program.enrollBaseUrl = `${process.env.ECOMMERCE_BASKET_URL}?${queryString.stringify({ bundle: basketCalculateQueryParameters.bundle }, { arrayFormat: 'index' })}`;
          program.skus = skus;
        } catch (err) {
          console.error('fetchEcommerceProgramData failed', err);
        }
      }
    };

    const fetchProgram = async (url, programs) => {
      try {
        const response = await discoveryLimiter.schedule(() => fetchWithRetry(url, accessTokenHeader));
        const { data } = response;

        await fetchEcommerceProgramData(data);
        const processedProgramNode = programSourceUtils.processProgram(data);
        programs.push(processedProgramNode);

        updateStatus('programs');
      } catch (err) {
        console.error('fetchProgram failed', err);
      }
    };

    const fetchProgramUrls = async (programList, paginationUrl) => {
      try {
        const response = await fetchWithRetry(paginationUrl, accessTokenHeader);
        const { data } = response;

        // Process programs in response
        data.results.forEach(async (program) => {
          const programUrlQueryParameters = {
            format: 'json',
            omit: programSourceUtils.omittedFields,
          };

          const programUrl = `${process.env.DISCOVERY_HOST_URL}${process.env.DISCOVERY_API_PATH}programs/${program.uuid}?${queryString.stringify(programUrlQueryParameters, { arrayFormat: 'comma' })}`;
          programList.push({ programUrl, uuid: program.uuid, courseUuids: program.courses });
        });

        // Get next program page and process those programs
        if (data.next) {
          await Promise.all([fetchProgramUrls(programList, discoverySourceUtils.getNextPage(data))]);
        }
      } catch (err) {
        console.error('fetchProgramUrls failed', err);
      }

      return programList;
    };

    const fetchSubjects = async (url, subjects) => {
      try {
        const response = await fetchWithRetry(url, accessTokenHeader);
        const { data } = response;
        status.bar.total = data.count;
        status.bar.curr = 0;

        // Process subjects in response
        data.results.forEach((subject) => {
          updateStatus('subjects');
          subjects.push(subjectSourceUtils.processSubject(subject));
        });

        if (data.next) {
          await fetchSubjects(discoverySourceUtils.getNextPage(data), subjects);
        }
      } catch (err) {
        console.error('fetchSubjects failed', err);
      }
    };

    const fetchTranslatedSubjects = async (url, subjects, languageCode) => {
      try {
        const languageUrl = `${url}&language_code=${languageCode}`;
        const response = await fetchWithRetry(languageUrl, accessTokenHeader);
        const { data } = response;
        status.bar.curr = 0;
        status.bar.total = data.count;

        // Process translated subject name, subtitle, and description in response
        data.results.forEach((subject) => {
          updateStatus('translated subjects');
          const baseSubject = subjects.find(s => s.uuid === subject.uuid);
          baseSubject.labels[languageCode] = subject.name;
          baseSubject.subtitles[languageCode] = subject.subtitle;
          baseSubject.descriptions[languageCode] = subject.description;
        });

        if (data.next) {
          await fetchTranslatedSubjects(
            discoverySourceUtils.getNextPage(data),
            subjects,
            languageCode,
          );
        }
      } catch (err) {
        console.error('fetchTranslatedSubjects failed', err);
      }
    };

    const getDiscoveryCollection = async (type, processObject) => {
      const all = await cache.get(`all${type}`);
      if (all && all.allResults) {
        console.info(`Retrieved ${type} collection from cache`);
        return all.allResults;
      }
      let allResults = [];
      try {
        const fullBaseURL = `${process.env.DISCOVERY_HOST_URL}${process.env.DISCOVERY_API_PATH}${type}`;
        const response = await fetchWithRetry(fullBaseURL, accessTokenHeader);
        const { data } = response;
        status.bar.curr = 0;
        status.bar.total = data.count;
        const processObjWithStatusBar = (object) => {
          updateStatus(type);
          return processObject(object);
        };
        allResults = await discoverySourceUtils.getSimplePagedData(fullBaseURL, processObjWithStatusBar);
        cache.set(`all${type}`, { allResults });
      } catch (err) {
        console.error(`getDiscoveryCollection(${type}) failed`, err);
        throw err;
      }
      return allResults;
    };

    const getPrograms = async () => {
      const allPrograms = await cache.get('allPrograms');
      if (allPrograms && allPrograms.programs) {
        console.info('Retrieved programs collection from cache');
        return allPrograms.programs;
      }
      const programUrls = [];

      const programApiQueryParameters = Object.assign(
        configOptions.programParameters,
        {
          fields: ['uuid'], // Only gather the uuids to then get the detail view
        },
      );

      const programsApiUrl = `${process.env.DISCOVERY_HOST_URL}${process.env.DISCOVERY_API_PATH}programs?${queryString.stringify(programApiQueryParameters, { arrayFormat: 'comma' })}`;
      await fetchProgramUrls(programUrls, programsApiUrl);

      console.log(`\nFetching ${programUrls.length} Programs.....\n`);
      status.bar.total = programUrls.length;
      status.bar.curr = 0;
      const programs = [];

      await Promise.all(programUrls.map(async program => fetchProgram(program.programUrl, programs)));
      cache.set('allPrograms', { programs });
      return programs;
    };

    const getCourses = async () => {
      const allCourses = await cache.get('allCourses');
      if (allCourses && allCourses.courses) {
        console.info('Retrieved courses collection from cache');
        return allCourses.courses;
      }
      status.bar.curr = 0;
      const courseApiQueryParameters = Object.assign(configOptions.courseParameters);

      // Get courses by supported subject
      const fullBaseURL = `${process.env.DISCOVERY_HOST_URL}${process.env.DISCOVERY_API_PATH}courses`;
      const coursesBySubjectUrl = `${fullBaseURL}?${queryString.stringify(courseApiQueryParameters, { arrayFormat: 'comma' })}`;
      const courses = [];
      await fetchCourses(coursesBySubjectUrl, courses);

      cache.set('allCourses', { courses });
      return courses;
    };

    const getSubjects = async () => {
      const allSubjects = await cache.get('allSubjects');
      if (allSubjects && allSubjects.subjects) {
        console.info('Retrieved subjects collection from cache');
        return allSubjects.subjects;
      }
      const subjects = [];

      // Convert the options object into a query string
      const subjectApiOptions = queryString.stringify(configOptions.subjectParameters, { arrayFormat: 'comma' });
      const subjectApiUrl = `${process.env.DISCOVERY_HOST_URL}${process.env.DISCOVERY_API_PATH}subjects?${subjectApiOptions}`;

      await fetchSubjects(subjectApiUrl, subjects);

      // Add translated names to each subject
      await Promise.all(JSON.parse(process.env.GATSBY_LANGUAGES).map(async (languageCode) => {
        console.log('\nFetching Translated Subjects.....\n');
        await fetchTranslatedSubjects(subjectApiUrl, subjects, languageCode);
      }));
      cache.set('allSubjects', { subjects });

      return subjects;
    };

    const getTopics = (courses) => {
      const topics = [];
      const map = new Map();
      courses.forEach((course) => {
        course.topics.forEach((t) => {
          if (!map.has(t.topic)) {
            map.set(t.topic, true);
            topics.push({
              topic: t.topic,
            });
          }
        });
      });
      return topics;
    };

    const getCurrencyMap = async () => {
      const currencyUrl = `${process.env.DISCOVERY_HOST_URL}${process.env.DISCOVERY_API_PATH}currency`;
      const response = await fetchWithRetry(currencyUrl, accessTokenHeader);

      const { data } = response;
      return data;
    };

    const currencyMapToListOfNodes = (currencyMap) => {
      const currencyList = [];
      const currencyMapKeys = Object.keys(currencyMap);
      currencyMapKeys.forEach((key) => {
        currencyList.push({
          ISO3: key,
          currencyInfo: currencyMap[key],
        });
      });
      if (currencyList.length === 0 && process.env.GATSBY_USE_LOCAL_DISCOVERY) {
        currencyList.push({
          ISO3: 'USD',
          currencyInfo: {
            code: 'USD',
            symbol: '$',
            rate: 1.0,
          },
        });
      }
      currencyList.forEach((currency) => {
        currency.id = currency.ISO3;
        currency.nodeId = generateNodeId(`${CURRENCY_TYPE}__${currency.id}`);
        createNode(currencyNode(currency));
      });
    };

    const addHitToResultList = (hit, resultsByPartner) => {
      hit.partnerKeys.forEach((partnerKey) => {
        if (resultsByPartner[partnerKey]) {
          resultsByPartner[partnerKey].push(hit);
        } else {
          resultsByPartner[partnerKey] = [hit];
        }
      });
    };

    const getSearchResults = async () => {
      const allResults = await cache.get('allSearchResults');
      if (allResults && allResults.allSearchResults) {
        console.info('Retrieved search results collection from cache');
        return allResults.allSearchResults;
      }
      const resultsByPartnerEN = {};
      const resultsByPartnerES = {};
      await browseIndexEN.browseObjects({
        batch: (hits) => {
          hits.forEach((hit) => addHitToResultList(camelCaseObject(hit), resultsByPartnerEN));
        },
      });
      await browseIndexES.browseObjects({
        batch: (hits) => {
          hits.forEach((hit) => addHitToResultList(camelCaseObject(hit), resultsByPartnerES));
        },
      });

      const allSearchResults = {
        resultsByPartnerEN,
        resultsByPartnerES,
      };
      cache.set('allSearchResults', { allSearchResults });
      return allSearchResults;
    };

    const getSearchRefinements = async () => {
      const allResults = await cache.get('allSearchRefinements');
      if (allResults && allResults.allSearchRefinements) {
        console.info('Retrieved search refinements collection from cache');
        return allResults.allSearchRefinements;
      }
      const { facets: allSearchRefinementsEN } = await searchIndexEN.search('', { facets: ['*'] });
      const { facets: allSearchRefinementsES } = await searchIndexES.search('', { facets: ['*'] });
      const allSearchRefinements = { allSearchRefinementsEN, allSearchRefinementsES };
      cache.set('allSearchRefinements', { allSearchRefinements });
      return allSearchRefinements;
    };

    const createNodesFromRefinementMap = (refinementMap, localeString) => {
      Object.entries(refinementMap).forEach(([facetName, facetValues]) => {
        const facetNode = {
          name: facetName,
        };
        const facetValuesArray = Object.entries(facetValues).map(([facetValueName, facetValueCount]) => (
          {
            valueName: facetValueName,
            count: facetValueCount,
          }
        ));
        facetNode.values = facetValuesArray;
        facetNode.nodeId = generateNodeId(`${INITIAL_SEARCH_REFINEMENT_TYPE}__${facetName}${localeString}`);
        createNode({
          locale: localeString,
          ...facetNode,
          id: facetNode.nodeId,
          internal: {
            type: INITIAL_SEARCH_REFINEMENT_TYPE,
            contentDigest: createContentDigest(facetNode),
          },
        });
      });
    };

    const fetchSingleCourse = async (uuid) => {
      try {
        const courseApiUrl = `${process.env.DISCOVERY_HOST_URL}${process.env.DISCOVERY_API_PATH}courses/${uuid}`;
        const response = await fetchWithRetry(courseApiUrl, accessTokenHeader);

        const { data } = response;

        return data;
      } catch (err) {
        console.error('fetchSingleCourse failed', err);
        process.exit();
      }
      return null;
    };

    const fetchSingleProgram = async (uuid) => {
      try {
        const programUrlQueryParameters = {
          format: 'json',
          omit: programSourceUtils.omittedFields,
        };
        const programUrl = `${process.env.DISCOVERY_HOST_URL}${process.env.DISCOVERY_API_PATH}programs/${uuid}?${queryString.stringify(programUrlQueryParameters, { arrayFormat: 'comma' })}`;
        const response = await fetchWithRetry(programUrl, accessTokenHeader);

        const { data } = response;

        return data;
      } catch (err) {
        console.error('fetchSingleProgram failed', err);
        process.exit();
      }
      return null;
    };

    const getLimitedCourses = async () => {
      const allCourses = await cache.get('limitedCourses');
      if (allCourses && allCourses.courses) {
        console.info('Retrieved courses collection from cache');
        return allCourses.courses;
      }
      const courses = await Promise.all(limitedCourseUUIDs.map(async uuid => {
        const course = await fetchSingleCourse(uuid);
        const processedCourse = courseSourceUtils.processCourse(course, createNodeId);
        return processedCourse;
      }));
      cache.set('limitedCourses', { courses });
      return courses;
    };

    const getLimitedPrograms = async () => {
      const allPrograms = await cache.get('limitedPrograms');
      if (allPrograms && allPrograms.programs) {
        console.info('Retrieved programs collection from cache');
        return allPrograms.programs;
      }
      const programs = await Promise.all(limitedProgramUUIDs.map(async uuid => {
        const program = await fetchSingleProgram(uuid);
        await fetchEcommerceProgramData(program);
        const processedProgram = programSourceUtils.processProgram(program);
        return processedProgram;
      }));
      cache.set('limitedPrograms', { programs });
      return programs;
    };

    const fetchCourseRecommendations = async (courses) => {
      status.bar.curr = 0;
      status.bar.total = courses.length;

      const resolvedCourses = await Promise.all(courses.map(async (course) => {
        if (experimentCoursesWithRecommendations.includes(course.uuid)) {
          try {
            const response = await discoveryLimiter.schedule(() => fetchWithRetry(`${process.env.DISCOVERY_HOST_URL}${process.env.DISCOVERY_API_PATH}course_recommendations/${course.key}`, accessTokenHeader));
            updateStatus('recommendations');
            return {
              ...course,
              recommendations: response.data.recommendations.map(({ uuid }) => ({ uuid })),
            };
          } catch (err) {
            console.error(`fetchRecommendations failed for course ${course.uuid}, ${course.title}`, err);
            return {
              ...course,
              recommendations: [],
            };
          }
        }

        updateStatus('recommendations');
        return {
          ...course,
          recommendations: [],
        };
      }));
      return resolvedCourses;
    };

    let courses = [];
    let programs = [];
    const fetchActivity = reporter.activityTimer('Discovery: Fetch data', {
      parentSpan,
    });
    fetchActivity.start();

    if (process.env.GATSBY_LIMIT_ONE_PAGE_PER_TYPE) {
      console.log('\nFetching limited Courses.....\n');
      courses = await getLimitedCourses();

      console.log('\nFetching limited Programs.....\n');
      programs = await getLimitedPrograms();
    } else {
      console.log('\nFetching Programs.....\n');
      programs = await getPrograms();

      console.log('\nFetching Courses.....\n');
      courses = await getCourses();
    }

    console.log('\nFetching Course Recommendations.....\n');
    courses = await fetchCourseRecommendations(courses);

    console.log('\nFetching Currency Mappings');
    const currencyMap = await getCurrencyMap();

    console.log('\nFetching Organizations');
    let organizations = await getDiscoveryCollection('organizations', object => object);

    console.log('\nFetching Subjects.....\n');
    let subjects = await getSubjects();

    console.log('\nGathering Topics.....\n');
    let topics = await getTopics(courses);

    console.log('\nFetching Search Results\n');
    const {
      resultsByPartnerEN,
      resultsByPartnerES,
    } = await getSearchResults();

    const { allSearchRefinementsEN, allSearchRefinementsES } = await getSearchRefinements();
    fetchActivity.end();

    const transformActivity = reporter.activityTimer('Discovery: Create Nodes', {
      parentSpan,
    });
    transformActivity.start();

    createNodesFromRefinementMap(allSearchRefinementsEN, 'en');
    createNodesFromRefinementMap(allSearchRefinementsES, 'es');

    currencyMapToListOfNodes(currencyMap);

    console.log('\nGathering subject and organization ordering...\n');

    organizations = camelCaseObject(organizations);
    organizations.forEach((org) => {
      org.id = org.uuid;
      org.orderedHitsEN = resultsByPartnerEN[org.key];
      org.orderedHitsES = resultsByPartnerES[org.key];
      org.nodeId = generateNodeId(`${ORGANIZATION_TYPE}__${org.id}`);
      createNode({
        ...org,
        id: org.nodeId,
        internal: {
          type: ORGANIZATION_TYPE,
          contentDigest: createContentDigest(org),
        },
      });
    });

    subjects = camelCaseObject(subjects);
    subjects.forEach((subject) => {
      subject.id = subject.uuid;
      subject.nodeId = generateNodeId(`${SUBJECT_TYPE}__${subject.id}`);
    });

    programs = camelCaseObject(programs);
    programs.forEach((program) => {
      program.id = program.uuid;
      program.nodeId = generateNodeId(`${PROGRAM_TYPE}__${program.id}`);
    });

    courses = camelCaseObject(courses);
    courses.forEach((course) => {
      course.id = course.uuid;
      course.nodeId = generateNodeId(`${COURSE_TYPE}__${course.id}`);
    });

    topics = camelCaseObject(topics);
    topics.forEach((topic) => {
      const id = generateNodeId(`${TOPIC_TYPE}__${topic.id}`);
      topic.name = topic.topic;
      topic.id = id;
      topic.nodeId = id;
    });

    // Create nodes and setup relationships! Behold the power of GraphQL!
    subjects.forEach((subject) => {
      subjectSourceUtils.subjectsEdges(subject, courses, programs);
      createNode({
        ...subject,
        id: subject.nodeId,
        internal: {
          type: SUBJECT_TYPE,
          contentDigest: createContentDigest(subject),
        },
      });
    });

    programs.forEach((program) => {
      programSourceUtils.programEdges(program, courses);
      createNode({
        ...program,
        id: program.nodeId,
        internal: {
          type: PROGRAM_TYPE,
          contentDigest: createContentDigest(program),
        },
      });
    });

    courses.forEach((course) => {
      courseSourceUtils.courseEdges(course, programs);
      courseSourceUtils.courseRecommendationEdges(course, courses);
      createNode({
        ...course,
        id: course.nodeId,
        internal: {
          type: COURSE_TYPE,
          contentDigest: createContentDigest(course),
        },
      });
    });

    // Topics rely on other relationships for programs and courses being set - do this last!
    topics.forEach((topic) => {
      topicSourceUtils.topicsEdges(topic, courses);
      createNode(topicNode(topic));
    });
    transformActivity.end();
  } catch (error) {
    console.error('sourceNodes error in gatsby-source-edx-discovery-catalog', error);
    throw error;
  }
};

console.log('--- DONE SOURCING DISCOVERY ---');
