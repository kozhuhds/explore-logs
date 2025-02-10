import { AdHocFiltersVariable, AdHocFilterWithLabels, SceneObject } from '@grafana/scenes';
import { DataSourceGetTagValuesOptions, GetTagResponse, MetricFindValue, ScopedVars, TimeRange } from '@grafana/data';
import { BackendSrvRequest, DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { getDataSource } from './scenes';
import { logger } from './logger';
import { LokiDatasource, LokiQuery } from './lokiQuery';
import { getDataSourceVariable, getValueFromFieldsFilter } from './variableGetters';
import { AdHocFiltersWithLabelsAndMeta, DetectedFieldType, VAR_LEVELS } from './variables';
import { isArray } from 'lodash';
import { FilterOp } from './filterTypes';
import { getFavoriteLabelValuesFromStorage } from './store';
import { UIVariableFilterType } from '../Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { ExpressionBuilder } from './ExpressionBuilder';
import { isOperatorInclusive, isOperatorRegex } from './operatorHelpers';

type FetchDetectedLabelValuesOptions = {
  expr?: string;
  timeRange?: TimeRange;
  limit?: number;
  scopedVars?: ScopedVars;
  throwError: boolean;
};

export type FetchDetectedFieldsOptions = {
  expr: string;
  timeRange?: TimeRange;
  limit?: number;
  scopedVars?: ScopedVars;
};

export type DetectedFieldsResult = Array<{
  label: string;
  type: DetectedFieldType;
  cardinality: number;
  parsers: Array<'logfmt' | 'json'> | null;
}>;

export interface LokiLanguageProviderWithDetectedLabelValues {
  fetchDetectedLabelValues: (
    labelName: string,
    queryOptions?: FetchDetectedLabelValuesOptions,
    requestOptions?: Partial<BackendSrvRequest>
  ) => Promise<string[] | Error>;

  fetchDetectedFields: (
    queryOptions?: FetchDetectedFieldsOptions,
    requestOptions?: Partial<BackendSrvRequest>
  ) => Promise<DetectedFieldsResult | Error>;
}

export const getDetectedFieldValuesTagValuesProvider = async (
  filter: AdHocFiltersWithLabelsAndMeta,
  variable: AdHocFiltersVariable,
  expr: string,
  sceneRef: SceneObject,
  timeRange: TimeRange,
  variableType: UIVariableFilterType
): Promise<{
  replace?: boolean;
  values: MetricFindValue[];
}> => {
  const datasourceUnknownType = await getDataSourceSrv().get(getDataSource(sceneRef));
  // Narrow the DataSourceApi type to DataSourceWithBackend
  if (!(datasourceUnknownType instanceof DataSourceWithBackend)) {
    logger.error(new Error('getTagValuesProvider: Invalid datasource!'));
    throw new Error('Invalid datasource!');
  }

  // Assert datasource is Loki
  const lokiDatasource = datasourceUnknownType as LokiDatasource;
  // Assert language provider is LokiLanguageProvider
  const languageProvider = lokiDatasource.languageProvider as LokiLanguageProviderWithDetectedLabelValues;

  let values: MetricFindValue[] = [];

  if (languageProvider && languageProvider.fetchDetectedLabelValues) {
    const options: FetchDetectedLabelValuesOptions = {
      expr,
      limit: 1000,
      timeRange,
      throwError: true,
    };

    const requestOptions: Partial<BackendSrvRequest> = {
      showErrorAlert: false,
    };

    try {
      let results = await languageProvider.fetchDetectedLabelValues(filter.key, options, requestOptions);
      if (results && isArray(results)) {
        // Always return all level values
        if (variableType === VAR_LEVELS) {
          return { replace: true, values: results.map((key) => ({ text: key })) };
        }

        const currentFilters = variable.state.filters;

        // Remove values that are already used, if an exact match is found
        let valuesToRemove: string[] = [];
        currentFilters.forEach((filter) => {
          const value = filter.valueLabels?.[0] ?? filter.value;
          if (isOperatorRegex(filter.operator)) {
            value.split('|').forEach((v) => valuesToRemove.push(v));
          } else {
            valuesToRemove.push(value);
          }
        });

        const filteredResults = results.filter((value) => {
          return !valuesToRemove.includes(value);
        });

        if (filter.meta?.parser !== 'structuredMetadata') {
          if (filter.value) {
            const valueDecoded = getValueFromFieldsFilter(filter, variableType);
            return {
              replace: true,
              values: filteredResults.map((v) => ({
                text: v,
                value: JSON.stringify({
                  value: v,
                  parser: valueDecoded.parser,
                }),
              })),
            };
          } else {
            // if the filter is wip, we trust that the parser was returned in the getTagKeys method, and added to the meta prop on the filter
            return {
              replace: true,
              values: filteredResults.map((v) => ({
                text: v,
                value: JSON.stringify({
                  value: v,
                  parser: filter.meta?.parser ?? 'mixed',
                }),
              })),
            };
          }
        } else {
          values = filteredResults.map((r) => ({ text: r }));
        }
      } else {
        values = [];
        logger.error(results, { msg: 'fetchDetectedLabelValues error!' });
      }
    } catch (e) {
      logger.error(e, {
        msg: 'getDetectedFieldValuesTagValuesProvider: loki missing detected_field/.../values endpoint. Upgrade to Loki 3.3.0 or higher.',
      });
      values = [];
    }
  } else {
    logger.warn(
      'getDetectedFieldValuesTagValuesProvider: fetchDetectedLabelValues is not defined in Loki datasource. Upgrade to Grafana 11.4 or higher.'
    );
    values = [];
  }

  return { replace: true, values };
};

function tagValuesFilterAdHocFilters(oldFilters: AdHocFilterWithLabels[], filter: AdHocFilterWithLabels<{}>) {
  let oldFiltersFiltered = oldFilters.filter(
    (f) => !(isOperatorInclusive(filter.operator) && f.key === filter.key && f.operator === FilterOp.Equal)
  );

  // If there aren't any inclusive filters, we need to ignore the exclusive ones as well, or Loki will throw an error
  if (!oldFiltersFiltered.some((filter) => isOperatorInclusive(filter.operator))) {
    oldFiltersFiltered = [];
  }
  return oldFiltersFiltered;
}

export async function getLabelsTagValuesProvider(
  variable: AdHocFiltersVariable,
  filter: AdHocFilterWithLabels
): Promise<{
  replace?: boolean;
  values: GetTagResponse | MetricFindValue[];
}> {
  const datasource_ = await getDataSourceSrv().get(getDataSource(variable));
  if (!(datasource_ instanceof DataSourceWithBackend)) {
    logger.error(new Error('getTagValuesProvider: Invalid datasource!'));
    throw new Error('Invalid datasource!');
  }
  const datasource = datasource_ as LokiDatasource;

  if (datasource && datasource.getTagValues) {
    // Filter out other values for this key so users can include other values for this label
    const filterTransformer = new ExpressionBuilder(variable.state.filters);
    const filters = filterTransformer.getJoinedLabelsFilters();
    const filtersFiltered = tagValuesFilterAdHocFilters(filters, filter);

    const options: DataSourceGetTagValuesOptions<LokiQuery> = {
      key: filter.key,
      filters: filtersFiltered,
    };

    let results = await datasource.getTagValues(options);

    if (isArray(results)) {
      results = results.filter((result) => {
        // Filter out values that we already have added as filters
        return !variable.state.filters
          .filter((f) => f.key === filter.key)
          .some((f) => {
            if (isOperatorRegex(f.operator)) {
              const values = f.value.split('|');
              return values.some((value) => value === result.text);
            } else {
              // If true, the results should be filtered out
              return f.operator === FilterOp.Equal && f.value === result.text;
            }
          });
      });
      const favoriteValuesArray = getFavoriteLabelValuesFromStorage(
        getDataSourceVariable(variable).getValue()?.toString(),
        filter.key
      );
      const favoriteValuesSet = new Set(favoriteValuesArray);
      if (favoriteValuesArray.length) {
        results.sort((a, b) => {
          return (favoriteValuesSet.has(b.text) ? 1 : -1) - (favoriteValuesSet.has(a.text) ? 1 : -1);
        });
      }
    }

    return { replace: true, values: results };
  } else {
    logger.error(new Error('getTagValuesProvider: missing or invalid datasource!'));
    return { replace: true, values: [] };
  }
}
