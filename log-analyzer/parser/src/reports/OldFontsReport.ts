/*
 *  @license
 *    Copyright 2018 Brigham Young University
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

import { Report } from '../report';
import { LogRow } from '../elf-parser';

export class OldFontsReport implements Report<string[]> {

    private results = new Set<string>();

    private hrms = new Set<string>();

    consume(line: LogRow) {
        const ref = line.request.referrer;
        if (ref && line.request.path.match(/^\/theme-fonts\/[^\/]+\/648398\/.*\.css$/)) {
            this.results.add(ref.host);
            if (ref.host === 'hrms.byu.edu') {
                console.log('found', ref.href, line.request.userAgent.ua);
                this.hrms.add(ref.href);
            }
        }
    }

    getResult(): string[] {
        return [...this.results];
    }

    name: string = 'old-fonts-usage';

    aggregate(one: string[], two: string[]): string[] {
        return [...new Set<string>([...one, ...two])].sort();
    }

    render(results: string[]): string {
        console.log(...this.hrms);
        return results.join('\n');
    }

    renderedExtension: string = 'txt'

}

/*

https://hrms.byu.edu/psp/ps/EMPLOYEE/HRMS/?cmd=expire
https://hrms.byu.edu/psc/ps/PUBLIC/HRMS/?cmd=expire
https://hrms.byu.edu/
https://hrms.byu.edu/psp/ps/EMPLOYEE/HRMS/c/ROLE_EMPLOYEE.PY_IC_PAY_INQ.GBL?NAVSTACK=Clear

 */