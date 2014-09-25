(function(angular) {
    'use strict';

    // Use existing module otherwise create a new one
    var module;
    try {
        module = angular.module('coUtils');
    } catch (e) {
        module = angular.module('coUtils', []);
    }
    
    module.
        factory('coSearch', [
            '$injector',
            '$timeout',
        function ($injector, $timeout) {

            // OPTIONS:
            //  resultVar (defaults to resourceName + s)
            //  loadingVar (defaults to resourceName + Loading)
            //  totalVar (defaults to ResourceName + Total)
            //  onError (optional callback when an error occurs)
            //  onReload (optional callback when a new search occurs)
            //
            //  mappings - {remoteParam: scopeValue}
            return function ($scope, resourceName, options) {
                options = options || {};

                var Resource = $injector.get(resourceName),
                    resultVar = options.resultVar || resourceName.toLowerCase() + 's',
                    loadingVar = options.loadingVar || resultVar + 'Loading',
                    totalVar = options.totalVar || resultVar + 'Total',
                    lookupVar = options.lookupVar || resultVar + 'Lookup',
                    offset = 0,
                    requestAborted = false,
                    requestCurrent,
                    searchId = 0,
                    params = {},
                    performQuery = function () {
                        var total = $scope[totalVar],
                            currentSearch = searchId,
                            query = angular.copy(params),
                            // Support for Object.keys === our minimum browser support
                            keys = Object.keys(params),
                            i;


                        if (total !== undefined && offset >= total) {
                            return;
                        }
                        query.offset = offset;

                        // remove any keys that are undefined
                        for (i = 0; i < keys.length; i += 1) {
                            if (query[keys[i]] === undefined) {
                                delete query[keys[i]];
                            }
                        }
                        $scope[loadingVar] = true;

                        // ignore any existing requests
                        if (requestCurrent && requestCurrent.reject) {
                            requestAborted = true;
                            requestCurrent.reject(true);
                        }

                        // Make the request and update the scope
                        requestCurrent = Resource.query(query).$promise;
                        requestCurrent.then(function (response) {
                            if (currentSearch !== searchId) {
                                return;
                            }

                            $scope[totalVar] = response.total;
                            offset += response.results.length;

                            // Convert the results to resource objects
                            var i, id, results = $scope[resultVar];
                            for (i = 0; i < response.results.length; i += 1) {
                                id = response.results[i].id;

                                // Prevent any duplicates in the array
                                if ($scope[lookupVar][id] === undefined) {
                                    $scope[lookupVar][id] = new Resource(response.results[i]);
                                    $scope[resultVar].push($scope[lookupVar][id]);
                                }
                            }

                            requestCurrent = undefined;
                            $scope[loadingVar] = false;
                        }, function (reason) {
                            if (!requestAborted && options.onError) {
                                requestCurrent = undefined;
                                try {
                                    options.onError(reason);
                                } catch (e) {}
                                $timeout(function () {
                                    $scope[loadingVar] = false;
                                }, 3000);
                            } else {
                                requestAborted = false;
                            }
                        });
                    },
                    newSearch = function () {
                        searchId += 1;
                        offset = 0;
                        $scope[lookupVar] = {};
                        $scope[resultVar] = [];
                        delete $scope[totalVar];
                        performQuery();
                        if (options.onReload) {
                            options.onReload();
                        }
                    };


                // mappings: {queryParam: scopeVal}
                angular.forEach(options.mappings || {}, function(value, key) {
                    params[key] = $scope.$eval(value);

                    $scope.$watch(value, function (newVal) {
                        if (params[key] !== newVal) {
                            params[key] = newVal;
                            newSearch();
                        }
                    });
                });

                // raw query values: {queryParam: val}
                angular.forEach(options.query || {}, function(value, key) {
                    params[key] = value;
                });

                newSearch();

                performQuery.resultKey = resultVar;
                performQuery.totalKey = totalVar;
                performQuery.loadingKey = loadingVar;

                return performQuery;
            };
        }]);

})(this.angular);  // this === window unless in a webworker
